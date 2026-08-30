"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { regenerateMilestones } from "@/app/(app)/income/actions";
import {
  getMilestoneSnapshotForTemplate,
  roundMoney,
} from "@/lib/milestones";
import type { ActionResult, SopRecord } from "@/lib/types/database";

const YEAR_MONTH_REGEX = /^\d{4}-\d{2}$/;

export async function initMonthSop(
  yearMonth: string
): Promise<ActionResult<SopRecord[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!YEAR_MONTH_REGEX.test(yearMonth)) return { success: false, error: "年月格式无效" };

  // 检查是否已有该月记录
  const { data: existing } = await supabase
    .from("sop_records")
    .select("id")
    .eq("year_month", yearMonth)
    .eq("owner_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    // 已存在，直接返回
    const { data, error } = await supabase
      .from("sop_records")
      .select("id, year_month, template_id, step_key, step_label, due_day, completed, completed_at, amount, note, sort_order, counts_toward_milestone, milestone_amount, created_at")
      .eq("year_month", yearMonth)
      .eq("owner_id", user.id)
      .order("sort_order");

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as SopRecord[] };
  }

  const [templatesRes, accountsRes] = await Promise.all([
    supabase
      .from("sop_templates")
      .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("accounts").select("id, purpose").eq("owner_id", user.id),
  ]);

  if (templatesRes.error) return { success: false, error: templatesRes.error.message };
  if (accountsRes.error) return { success: false, error: accountsRes.error.message };

  const templates = templatesRes.data || [];
  const accounts = accountsRes.data || [];

  if (templates.length === 0) {
    return { success: true, data: [] };
  }

  const accountPurposeById = new Map(
    accounts.map((account) => [account.id, account.purpose])
  );

  const records = templates.map((tpl) => {
    const milestoneSnapshot = getMilestoneSnapshotForTemplate({
      toAccountId: tpl.to_account_id,
      defaultAmount: tpl.default_amount,
      accountPurposeById,
    });

    return {
      owner_id: user.id,
      year_month: yearMonth,
      template_id: tpl.id,
      step_key: tpl.step_key,
      step_label: tpl.step_label,
      due_day: tpl.due_day,
      amount: tpl.default_amount,
      sort_order: tpl.sort_order,
      ...milestoneSnapshot,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from("sop_records")
    .insert(records)
    .select("id, year_month, template_id, step_key, step_label, due_day, completed, completed_at, amount, note, sort_order, counts_toward_milestone, milestone_amount, created_at");

  if (insertError) return { success: false, error: insertError.message };

  await regenerateMilestones();
  revalidatePath("/sop");
  return { success: true, data: inserted as SopRecord[] };
}

export async function toggleSopStep(
  id: string,
  completed: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!id || typeof id !== "string" || id.trim() === "") return { success: false, error: "ID无效" };

  const { data, error } = await supabase
    .from("sop_records")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "记录不存在" };

  await regenerateMilestones();
  revalidatePath("/sop");
  return { success: true, data: undefined };
}

export async function addAdHocSopStep(
  yearMonth: string,
  data: { step_label: string; due_day: number; amount?: number; note?: string }
): Promise<ActionResult<SopRecord>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!YEAR_MONTH_REGEX.test(yearMonth)) return { success: false, error: "年月格式无效" };
  if (!data.step_label || data.step_label.trim() === "") return { success: false, error: "步骤名称不能为空" };
  if (data.due_day < 1 || data.due_day > 31) return { success: false, error: "执行日无效" };
  if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) return { success: false, error: "金额无效" };

  // 生成唯一 step_key（临时步骤用时间戳）
  const stepKey = `adhoc_${Date.now()}`;

  // 获取当前最大 sort_order
  const { data: maxRecord } = await supabase
    .from("sop_records")
    .select("sort_order")
    .eq("year_month", yearMonth)
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRecord?.sort_order ?? 0) + 10;

  const { data: inserted, error } = await supabase
    .from("sop_records")
    .insert({
      owner_id: user.id,
      year_month: yearMonth,
      template_id: null,
      step_key: stepKey,
      step_label: data.step_label.trim(),
      due_day: data.due_day,
      amount: data.amount ?? null,
      note: data.note ?? null,
      sort_order: sortOrder,
      counts_toward_milestone: false,
      milestone_amount: null,
    })
    .select("id, year_month, template_id, step_key, step_label, due_day, completed, completed_at, amount, note, sort_order, counts_toward_milestone, milestone_amount, created_at")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/sop");
  return { success: true, data: inserted as SopRecord };
}

export async function deleteAdHocSopStep(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!id || id.trim() === "") return { success: false, error: "ID无效" };

  // 只允许删除临时步骤（template_id 为 null）
  const { data: record } = await supabase
    .from("sop_records")
    .select("template_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!record) return { success: false, error: "记录不存在" };
  if (record.template_id !== null) return { success: false, error: "模板步骤不能删除，请在设置中管理" };

  const { data: deleted, error } = await supabase
    .from("sop_records")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!deleted) return { success: false, error: "记录不存在" };
  revalidatePath("/sop");
  return { success: true, data: undefined };
}

export async function updateSopStep(
  id: string,
  data: { note?: string; amount?: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) return { success: false, error: "金额无效" };

  const { data: existing, error: existingError } = await supabase
    .from("sop_records")
    .select("counts_toward_milestone")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingError) return { success: false, error: existingError.message };
  if (!existing) return { success: false, error: "记录不存在" };

  const updates: { note?: string; amount?: number; counts_toward_milestone?: boolean; milestone_amount?: number | null } = {
    ...data,
  };

  if (data.amount !== undefined && existing.counts_toward_milestone) {
    const nextAmount = roundMoney(data.amount);
    if (nextAmount > 0) {
      updates.milestone_amount = nextAmount;
    } else {
      updates.counts_toward_milestone = false;
      updates.milestone_amount = null;
    }
  }

  const { data: updated, error } = await supabase
    .from("sop_records")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "记录不存在" };

  if (data.amount !== undefined) {
    await regenerateMilestones();
  }

  revalidatePath("/sop");
  return { success: true, data: undefined };
}
