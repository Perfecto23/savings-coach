import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { AccountBalanceCard } from "@/components/balances/account-balance-card";
import { BalanceForm } from "@/components/balances/balance-form";
import type { Account, BalanceSnapshot } from "@/lib/types/database";

const BalanceHistoryChart = dynamic(
  () =>
    import("@/components/balances/balance-history-chart").then(
      (m) => m.BalanceHistoryChart
    )
);

export default async function BalancesPage() {
  const supabase = await createClient();

  const [accountsRes, snapshotsRes] = await Promise.all([
    supabase.from("accounts").select("*").order("sort_order"),
    supabase
      .from("balance_snapshots")
      .select("*")
      .order("recorded_at", { ascending: true }),
  ]);

  const accounts = (accountsRes.data || []) as Account[];
  const snapshots = (snapshotsRes.data || []) as BalanceSnapshot[];

  // 每个账户的最新快照
  const latestByAccount = new Map<string, BalanceSnapshot>();
  for (const snap of snapshots) {
    latestByAccount.set(snap.account_id, snap);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">余额记录</h1>
        <p className="mt-1 text-sm text-gray-500">
          追踪所有账户余额变化
        </p>
      </div>

      {/* 账户卡片 */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {accounts.map((account) => (
            <AccountBalanceCard
              key={account.id}
              account={account}
              latestSnapshot={latestByAccount.get(account.id) ?? null}
            />
          ))}
        </div>
      )}

      {/* 余额录入 */}
      <BalanceForm accounts={accounts} />

      {/* 趋势图 */}
      <BalanceHistoryChart accounts={accounts} snapshots={snapshots} />
    </div>
  );
}
