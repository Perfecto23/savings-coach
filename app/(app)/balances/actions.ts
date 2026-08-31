"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  BalanceActionErrorCode,
  BalanceHistoryResult,
  BalanceMutationResult,
} from "@/lib/balances/presentation";

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export async function saveBalanceSnapshot(
  date: string,
  balances: { account_id: string; balance: number; note?: string }[]
): Promise<BalanceMutationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (!YYYY_MM_DD.test(date)) return { success: false, error: "INVALID_DATE" };
  if (balances.length === 0) {
    return { success: false, error: "EMPTY_OBSERVATIONS" };
  }
  for (const b of balances) {
    if (!b.account_id || typeof b.account_id !== "string" || b.account_id.trim() === "") return { success: false, error: "INVALID_ACCOUNT" };
    if (!Number.isFinite(b.balance) || b.balance < 0) return { success: false, error: "INVALID_BALANCE" };
  }

  if (new Set(balances.map((balance) => balance.account_id)).size !== balances.length) {
    return { success: false, error: "DUPLICATE_ACCOUNT" };
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
    const stableErrors: Record<string, BalanceActionErrorCode> = {
      invalid_observation_date: "INVALID_DATE",
      invalid_observations: "EMPTY_OBSERVATIONS",
      invalid_observation: "INVALID_ACCOUNT",
      invalid_observation_balance: "INVALID_BALANCE",
      duplicate_observation_account: "DUPLICATE_ACCOUNT",
      account_not_found: "ACCOUNT_NOT_FOUND",
      plan_path_incomplete: "PLAN_PATH_INCOMPLETE",
    };
    return {
      success: false,
      error: stableErrors[error.message] || "SAVE_FAILED",
    };
  }
  if (error) return { success: false, error: "SAVE_FAILED" };

  revalidatePath("/balances");
  revalidatePath("/milestones");
  revalidatePath("/plan");
  revalidatePath("/");
  return { success: true, data: undefined };
}

export async function deleteBalanceSnapshotsByDate(
  date: string
): Promise<BalanceMutationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  if (!YYYY_MM_DD.test(date)) return { success: false, error: "INVALID_DATE" };

  const { error } = await supabase.rpc("delete_balance_observations", {
    p_recorded_at: date,
  });
  if (error?.code === "P0001") {
    const stableErrors: Record<string, BalanceActionErrorCode> = {
      observation_not_found: "OBSERVATION_NOT_FOUND",
      last_setup_observation_delete_forbidden: "SETUP_OBSERVATION_REQUIRED",
      plan_path_incomplete: "PLAN_PATH_INCOMPLETE",
    };
    return {
      success: false,
      error: stableErrors[error.message] || "DELETE_FAILED",
    };
  }
  if (error) return { success: false, error: "DELETE_FAILED" };

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
): Promise<BalanceHistoryResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };

  const { data: ownedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id);
  if (accountsError) return { success: false, error: "LOAD_FAILED" };

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

  if (error) return { success: false, error: "LOAD_FAILED" };
  return { success: true, data };
}
