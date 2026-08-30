"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, BalanceSnapshot } from "@/lib/types/database";
import { regenerateMilestones } from "@/app/(app)/income/actions";

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

  const accountIds = balances.map((balance) => balance.account_id);
  if (new Set(accountIds).size !== accountIds.length) {
    return { success: false, error: "账户余额包含重复账户" };
  }

  const { data: ownedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id)
    .in("id", accountIds);

  if (accountsError) return { success: false, error: accountsError.message };
  if ((ownedAccounts || []).length !== accountIds.length) {
    return { success: false, error: "账户不存在" };
  }

  // upsert: 同一账户同一天只有一条记录
  const records = balances
    .filter((b) => b.balance != null)
    .map((b) => ({
      account_id: b.account_id,
      recorded_at: date,
      balance: b.balance,
      note: b.note || null,
    }));

  if (records.length === 0) {
    return { success: false, error: "请至少填写一个账户余额" };
  }

  const { error } = await supabase
    .from("balance_snapshots")
    .upsert(records, { onConflict: "account_id,recorded_at" });

  if (error) return { success: false, error: error.message };
  revalidatePath("/balances");

  // 余额变更时自动更新里程碑（实际数据 + 后续目标级联）
  await regenerateMilestones();

  return { success: true, data: undefined };
}

export async function deleteBalanceSnapshotsByDate(
  date: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!YYYY_MM_DD.test(date)) return { success: false, error: "日期格式无效" };

  const { data: ownedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_id", user.id);
  if (accountsError) return { success: false, error: accountsError.message };

  const ownedAccountIds = (ownedAccounts || []).map((account) => account.id);
  if (ownedAccountIds.length === 0) {
    return { success: false, error: "记录不存在" };
  }

  const { data, error } = await supabase
    .from("balance_snapshots")
    .delete()
    .eq("recorded_at", date)
    .in("account_id", ownedAccountIds)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: false, error: "记录不存在" };
  revalidatePath("/balances");
  await regenerateMilestones();
  return { success: true, data: undefined };
}

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
