"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, BalanceSnapshot } from "@/lib/types/database";

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export async function saveBalanceSnapshot(
  date: string,
  balances: { account_id: string; balance: number; note?: string }[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!YYYY_MM_DD.test(date)) return { success: false, error: "日期格式无效" };
  if (balances.length === 0) {
    return { success: false, error: "请至少填写一个账户余额" };
  }
  for (const b of balances) {
    if (!b.account_id || typeof b.account_id !== "string" || b.account_id.trim() === "") return { success: false, error: "账户ID无效" };
    if (!Number.isFinite(b.balance) || b.balance < 0) return { success: false, error: "余额无效" };
  }

  if (new Set(balances.map((balance) => balance.account_id)).size !== balances.length) {
    return { success: false, error: "账户余额包含重复账户" };
  }

  const observations = balances.map((balance) => ({
      account_id: balance.account_id,
      balance: String(balance.balance),
      note: balance.note?.trim() || null,
    }));

  const { error } = await supabase.rpc("save_balance_observations", {
    p_recorded_at: date,
    p_balances: observations,
  });
  if (error?.code === "P0001") {
    const stableErrors: Record<string, string> = {
      invalid_observation_date: "Choose a valid observation date that is not in the future.",
      invalid_observations: "Enter at least one valid Balance Snapshot.",
      invalid_observation: "Check each Balance Snapshot and try again.",
      invalid_observation_balance: "Enter non-negative balances with at most two decimal places.",
      duplicate_observation_account: "Each account can appear once per observation date.",
      account_not_found: "One selected account was not found.",
      plan_path_incomplete: "Your Plan Path needs attention before Balance Snapshots can change.",
    };
    return {
      success: false,
      error: stableErrors[error.message] || "Balance Snapshots could not be saved. Try again.",
    };
  }
  if (error) return { success: false, error: "Balance Snapshots could not be saved. Try again." };

  revalidatePath("/balances");
  revalidatePath("/milestones");
  revalidatePath("/plan");
  revalidatePath("/");
  return { success: true, data: undefined };
}

export async function deleteBalanceSnapshotsByDate(
  date: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!YYYY_MM_DD.test(date)) return { success: false, error: "日期格式无效" };

  const { error } = await supabase.rpc("delete_balance_observations", {
    p_recorded_at: date,
  });
  if (error?.code === "P0001") {
    const stableErrors: Record<string, string> = {
      observation_not_found: "No Balance Snapshots exist for this observation date.",
      last_setup_observation_delete_forbidden:
        "Keep at least one Balance Snapshot for your Setup Savings Account.",
      plan_path_incomplete: "Your Plan Path needs attention before Balance Snapshots can change.",
    };
    return {
      success: false,
      error: stableErrors[error.message] || "Balance Snapshots could not be deleted. Try again.",
    };
  }
  if (error) return { success: false, error: "Balance Snapshots could not be deleted. Try again." };

  revalidatePath("/balances");
  revalidatePath("/milestones");
  revalidatePath("/plan");
  revalidatePath("/");
  return { success: true, data: undefined };
}

/*
  Read-only history remains a direct owner-scoped query. Writes above use the
  transactional Balance Observation RPCs.
*/
export async function getBalanceHistory(
  months: number = 6
): Promise<ActionResult<BalanceSnapshot[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const { data: ownedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id);
  if (accountsError) return { success: false, error: accountsError.message };

  const ownedAccountIds = (ownedAccounts || []).map((account) => account.id);
  if (ownedAccountIds.length === 0) {
    return { success: true, data: [] };
  }

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const startStr = startDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("balance_snapshots")
    .select("*")
    .in("account_id", ownedAccountIds)
    .gte("recorded_at", startStr)
    .order("recorded_at");

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as BalanceSnapshot[] };
}
