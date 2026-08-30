"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Account, SopTemplate, AiConfig } from "@/lib/types/database";
import { regenerateMilestones } from "@/app/(app)/income/actions";

const ACCOUNT_PURPOSES = ["salary", "fixed_expense", "dating_fund", "savings", "flexible", "housing_fund"] as const;

function getInstitution(formData: FormData) {
  const institution = String(formData.get("bank") || "").trim();
  return institution || null;
}

// ============================================
// 账户 CRUD
// ============================================

export async function getAccounts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "未登录" };
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("sort_order");

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data: data as Account[] };
}

export async function createAccount(
  formData: FormData
): Promise<ActionResult<Account>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const name = (formData.get("name") as string) || "";
  const purpose = formData.get("purpose") as string;
  if (!name.trim()) return { success: false, error: "账户名称不能为空" };
  if (!ACCOUNT_PURPOSES.includes(purpose as (typeof ACCOUNT_PURPOSES)[number])) return { success: false, error: "用途无效" };

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      owner_id: user.id,
      name: name.trim(),
      bank: getInstitution(formData),
      purpose: formData.get("purpose") as string,
      icon: (formData.get("icon") as string) || "🏦",
      sort_order: Number(formData.get("sort_order") || 0),
    })
    .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: data as Account };
}

export async function updateAccount(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const name = (formData.get("name") as string) || "";
  const purpose = formData.get("purpose") as string;
  if (!name.trim()) return { success: false, error: "账户名称不能为空" };
  if (!ACCOUNT_PURPOSES.includes(purpose as (typeof ACCOUNT_PURPOSES)[number])) return { success: false, error: "用途无效" };

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name: name.trim(),
      bank: getInstitution(formData),
      purpose: formData.get("purpose") as string,
      icon: (formData.get("icon") as string) || "🏦",
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "账户不存在" };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { data, error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (
    error?.code === "P0001" &&
    error.message === "setup_linked_account_delete_forbidden"
  ) {
    return {
      success: false,
      error: "Choose a different Setup Savings Account before deleting this account.",
    };
  }
  if (error?.code === "23503") {
    return {
      success: false,
      error: "Delete this account’s Balance Snapshots before deleting the account.",
    };
  }
  if (error) return { success: false, error: "The account could not be deleted. Try again." };
  if (!data) return { success: false, error: "账户不存在" };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function reorderAccounts(
  orderedIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return { success: false, error: "账户排序包含重复账户" };
  }

  const { data: ownedAccounts, error: ownershipError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id)
    .in("id", orderedIds);

  if (ownershipError) return { success: false, error: ownershipError.message };
  if ((ownedAccounts || []).length !== orderedIds.length) {
    return { success: false, error: "账户排序包含无效账户" };
  }

  const updates = orderedIds.map((id, index) =>
    supabase
      .from("accounts")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle()
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { success: false, error: failed.error.message };
  if (results.some((result) => !result.data)) {
    return { success: false, error: "账户排序包含无效账户" };
  }

  revalidatePath("/settings");
  return { success: true, data: undefined };
}

// ============================================
// SOP 模板 CRUD
// ============================================

export async function getSopTemplates() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "未登录" };
  const { data, error } = await supabase
    .from("sop_templates")
    .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
    .eq("owner_id", user.id)
    .eq("is_plan_rule", false)
    .order("sort_order");

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data: data as SopTemplate[] };
}

export async function createSopTemplate(
  formData: FormData
): Promise<ActionResult<SopTemplate>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const stepLabel = (formData.get("step_label") as string) || "";
  const dueDay = Number(formData.get("due_day"));
  if (!stepLabel.trim()) return { success: false, error: "步骤名称不能为空" };
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return { success: false, error: "到期日必须在1-31之间" };

  const { data, error } = await supabase
    .from("sop_templates")
    .insert({
      owner_id: user.id,
      step_key: formData.get("step_key") as string,
      step_label: formData.get("step_label") as string,
      due_day: Number(formData.get("due_day")),
      from_account_id: (formData.get("from_account_id") as string) || null,
      to_account_id: (formData.get("to_account_id") as string) || null,
      default_amount: formData.get("default_amount")
        ? Number(formData.get("default_amount"))
        : null,
      sort_order: Number(formData.get("sort_order") || 0),
      is_active: formData.get("is_active") === "true",
      is_plan_rule: false,
    })
    .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  await regenerateMilestones();
  return { success: true, data: data as SopTemplate };
}

export async function updateSopTemplate(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const stepLabel = (formData.get("step_label") as string) || "";
  const dueDay = Number(formData.get("due_day"));
  if (!stepLabel.trim()) return { success: false, error: "步骤名称不能为空" };
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return { success: false, error: "到期日必须在1-31之间" };

  const { data, error } = await supabase
    .from("sop_templates")
    .update({
      step_key: formData.get("step_key") as string,
      step_label: formData.get("step_label") as string,
      due_day: Number(formData.get("due_day")),
      from_account_id: (formData.get("from_account_id") as string) || null,
      to_account_id: (formData.get("to_account_id") as string) || null,
      default_amount: formData.get("default_amount")
        ? Number(formData.get("default_amount"))
        : null,
      is_active: formData.get("is_active") === "true",
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("is_plan_rule", false)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "SOP 模板不存在" };
  revalidatePath("/settings");
  await regenerateMilestones();
  return { success: true, data: undefined };
}

export async function deleteSopTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { data, error } = await supabase
    .from("sop_templates")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("is_plan_rule", false)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "SOP 模板不存在" };
  revalidatePath("/settings");
  await regenerateMilestones();
  return { success: true, data: undefined };
}

// ============================================
// AI 配置 CRUD
// ============================================

const AI_DISABLED_ERROR = "当前版本未开放 AI 配置";

export async function getAiConfigs() {
  return { success: false as const, error: AI_DISABLED_ERROR };
}

export async function saveAiConfig(
  _formData: FormData
): Promise<ActionResult<AiConfig>> {
  void _formData;
  return { success: false, error: AI_DISABLED_ERROR };
}

export async function updateAiConfig(
  _id: string,
  _formData: FormData
): Promise<ActionResult> {
  void _id;
  void _formData;
  return { success: false, error: AI_DISABLED_ERROR };
}

export async function deleteAiConfig(_id: string): Promise<ActionResult> {
  void _id;
  return { success: false, error: AI_DISABLED_ERROR };
}

export async function setActiveAiConfig(_id: string): Promise<ActionResult> {
  void _id;
  return { success: false, error: AI_DISABLED_ERROR };
}
