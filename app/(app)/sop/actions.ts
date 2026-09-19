"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { regenerateMilestones } from "@/app/(app)/income/actions";
import {
  getMilestoneSnapshotForTemplate,
  roundMoney,
} from "@/lib/milestones";
import type { ActionResult } from "@/lib/types/database";
import type { SopDisplayRecord } from "@/lib/sop/contracts";

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

async function readDisplayRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  yearMonth: string
): Promise<ActionResult<SopDisplayRecord[]>> {
  const { data, error } = await supabase.rpc("get_sop_display_records", {
    p_year_month: yearMonth,
  });
  if (error) {
    return { success: false, error: "LOAD_FAILED" };
  }
  return { success: true, data: (data || []) as SopDisplayRecord[] };
}

export async function initMonthSop(
  yearMonth: string
): Promise<ActionResult<SopDisplayRecord[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (!YEAR_MONTH_REGEX.test(yearMonth)) return { success: false, error: "INVALID_MONTH" };

  // 检查是否已有该月记录
  const { data: existing } = await supabase
    .from("sop_records")
    .select("id")
    .eq("year_month", yearMonth)
    .eq("owner_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return readDisplayRecords(supabase, yearMonth);
  }

  const [templatesRes, accountsRes] = await Promise.all([
    supabase
      .from("sop_templates")
      .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .eq("is_plan_rule", false)
      .order("sort_order"),
    supabase.from("accounts").select("id, purpose").eq("owner_id", user.id),
  ]);

  if (templatesRes.error) return { success: false, error: "LOAD_FAILED" };
  if (accountsRes.error) return { success: false, error: "LOAD_FAILED" };

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

  if (insertError) return { success: false, error: "SAVE_FAILED" };

  await regenerateMilestones();
  revalidatePath("/sop");
  void inserted;
  return readDisplayRecords(supabase, yearMonth);
}

export async function toggleSopStep(
  id: string,
  completed: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (!id || typeof id !== "string" || id.trim() === "") return { success: false, error: "INVALID_ID" };

  const { data: existing, error: existingError } = await supabase
    .from("sop_records")
    .select("is_monthly_action")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existingError) return { success: false, error: "LOAD_FAILED" };
  if (!existing) return { success: false, error: "NOT_FOUND" };

  if (existing.is_monthly_action) {
    const { error } = await supabase.rpc("update_monthly_action", {
      p_action_id: id,
      p_patch: { completed },
    });
    if (error) return { success: false, error: "UPDATE_FAILED" };

    revalidatePath("/sop");
    revalidatePath("/plan");
    revalidatePath("/milestones");
    revalidatePath("/");
    return { success: true, data: undefined };
  }

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

  if (error) return { success: false, error: "UPDATE_FAILED" };
  if (!data) return { success: false, error: "NOT_FOUND" };

  await regenerateMilestones();
  revalidatePath("/sop");
  return { success: true, data: undefined };
}

export async function addAdHocSopStep(
  yearMonth: string,
  data: { step_label: string; due_day: number; amount?: number; note?: string }
): Promise<ActionResult<SopDisplayRecord>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (!YEAR_MONTH_REGEX.test(yearMonth)) return { success: false, error: "INVALID_MONTH" };
  if (!data.step_label || data.step_label.trim() === "") return { success: false, error: "INVALID_LABEL" };
  if (data.due_day < 1 || data.due_day > 31) return { success: false, error: "INVALID_DAY" };
  if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) return { success: false, error: "INVALID_AMOUNT" };

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
    .select("id")
    .single();

  if (error) return { success: false, error: "SAVE_FAILED" };
  revalidatePath("/sop");
  const displayResult = await readDisplayRecords(supabase, yearMonth);
  if (!displayResult.success) return displayResult;
  const displayRecord = displayResult.data.find(
    (record) => record.id === inserted.id
  );
  if (!displayRecord) {
    return { success: false, error: "LOAD_FAILED" };
  }
  return { success: true, data: displayRecord };
}

export async function deleteAdHocSopStep(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (!id || id.trim() === "") return { success: false, error: "INVALID_ID" };

  // 只允许删除临时步骤（template_id 为 null）
  const { data: record } = await supabase
    .from("sop_records")
    .select("template_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!record) return { success: false, error: "NOT_FOUND" };
  if (record.template_id !== null) return { success: false, error: "DELETE_FORBIDDEN" };

  const { data: deleted, error } = await supabase
    .from("sop_records")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: "SAVE_FAILED" };
  if (!deleted) return { success: false, error: "NOT_FOUND" };
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
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) return { success: false, error: "INVALID_AMOUNT" };
  if (data.note !== undefined && data.note.length > 1000) return { success: false, error: "INVALID_NOTE" };

  const { data: existing, error: existingError } = await supabase
    .from("sop_records")
    .select("counts_toward_milestone, is_monthly_action")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingError) return { success: false, error: "LOAD_FAILED" };
  if (!existing) return { success: false, error: "NOT_FOUND" };

  if (existing.is_monthly_action) {
    const patch: { note?: string; amount?: string } = {};
    if (data.note !== undefined) patch.note = data.note;
    if (data.amount !== undefined) patch.amount = String(data.amount);

    const { error } = await supabase.rpc("update_monthly_action", {
      p_action_id: id,
      p_patch: patch,
    });
    if (error) return { success: false, error: "UPDATE_FAILED" };

    revalidatePath("/sop");
    revalidatePath("/plan");
    revalidatePath("/milestones");
    revalidatePath("/");
    return { success: true, data: undefined };
  }

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

  if (error) return { success: false, error: "UPDATE_FAILED" };
  if (!updated) return { success: false, error: "NOT_FOUND" };

  if (data.amount !== undefined) {
    await regenerateMilestones();
  }

  revalidatePath("/sop");
  return { success: true, data: undefined };
}
