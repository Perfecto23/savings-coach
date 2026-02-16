"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Account, SopTemplate, AiConfig } from "@/lib/types/database";
import { regenerateMilestones } from "@/app/(app)/income/actions";

const ACCOUNT_PURPOSES = ["salary", "fixed_expense", "dating_fund", "savings", "flexible", "housing_fund"] as const;

// ============================================
// 账户 CRUD
// ============================================

export async function getAccounts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "未登录" };
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
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
      name: name.trim(),
      bank: formData.get("bank") as string,
      purpose: formData.get("purpose") as string,
      icon: (formData.get("icon") as string) || "🏦",
      sort_order: Number(formData.get("sort_order") || 0),
    })
    .select()
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

  const { error } = await supabase
    .from("accounts")
    .update({
      name: name.trim(),
      bank: formData.get("bank") as string,
      purpose: formData.get("purpose") as string,
      icon: (formData.get("icon") as string) || "🏦",
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { error } = await supabase.from("accounts").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function reorderAccounts(
  orderedIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const updates = orderedIds.map((id, index) =>
    supabase.from("accounts").update({ sort_order: index }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { success: false, error: failed.error.message };

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
    .select("*")
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
    })
    .select()
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

  const { error } = await supabase
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
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  await regenerateMilestones();
  return { success: true, data: undefined };
}

export async function deleteSopTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { error } = await supabase.from("sop_templates").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  await regenerateMilestones();
  return { success: true, data: undefined };
}

// ============================================
// AI 配置 CRUD
// ============================================

export async function getAiConfigs() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "未登录" };
  const { data, error } = await supabase
    .from("ai_configs")
    .select("*")
    .order("created_at");

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data: data as AiConfig[] };
}

export async function saveAiConfig(
  formData: FormData
): Promise<ActionResult<AiConfig>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const apiUrl = (formData.get("api_url") as string) || "";
  const modelName = (formData.get("model_name") as string) || "";
  const apiKey = (formData.get("api_key") as string) || "";
  if (!apiUrl.startsWith("http")) return { success: false, error: "API地址必须以http开头" };
  if (!modelName.trim()) return { success: false, error: "模型名称不能为空" };
  if (!apiKey.trim()) return { success: false, error: "API密钥不能为空" };

  const { data, error } = await supabase
    .from("ai_configs")
    .insert({
      provider_name: formData.get("provider_name") as string,
      api_url: formData.get("api_url") as string,
      api_key: formData.get("api_key") as string,
      model_name: formData.get("model_name") as string,
      is_active: formData.get("is_active") === "true",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: data as AiConfig };
}

export async function updateAiConfig(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const apiUrl = (formData.get("api_url") as string) || "";
  const modelName = (formData.get("model_name") as string) || "";
  const apiKey = (formData.get("api_key") as string) || "";
  if (!apiUrl.startsWith("http")) return { success: false, error: "API地址必须以http开头" };
  if (!modelName.trim()) return { success: false, error: "模型名称不能为空" };
  if (!apiKey.trim()) return { success: false, error: "API密钥不能为空" };

  const { error } = await supabase
    .from("ai_configs")
    .update({
      provider_name: formData.get("provider_name") as string,
      api_url: formData.get("api_url") as string,
      api_key: formData.get("api_key") as string,
      model_name: formData.get("model_name") as string,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function deleteAiConfig(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { error } = await supabase.from("ai_configs").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}

export async function setActiveAiConfig(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  // 先把所有配置设为非激活
  await supabase.from("ai_configs").update({ is_active: false }).neq("id", "");

  // 再将目标配置设为激活
  const { error } = await supabase
    .from("ai_configs")
    .update({ is_active: true })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, data: undefined };
}
