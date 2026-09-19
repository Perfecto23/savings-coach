import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountBalanceCard } from "@/components/balances/account-balance-card";
import { BalanceForm } from "@/components/balances/balance-form";
import type { Account } from "@/lib/types/database";
import type { BalanceDisplaySnapshot } from "@/lib/balances/contracts";
import { getBalancesCopy } from "@/lib/balances/presentation";
import { APP_LOCALE } from "@/lib/product-locale";

function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

const BalanceHistoryChart = dynamic(
  () =>
    import("@/components/balances/balance-history-chart").then(
      (m) => m.BalanceHistoryChart
    )
);

export default async function BalancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accountsRes, snapshotsRes, setupRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("sort_order"),
    supabase
      .from("balance_snapshots")
      .select("account_id, recorded_at, balance")
      .order("recorded_at", { ascending: true }),
    supabase
      .from("owner_setup")
      .select("time_zone, base_currency")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (accountsRes.error || snapshotsRes.error || setupRes.error || !setupRes.data) {
    throw new Error("Unable to load balance records");
  }

  const accounts = (accountsRes.data || []) as Account[];
  const snapshots = (snapshotsRes.data || []) as BalanceDisplaySnapshot[];
  const locale = APP_LOCALE;
  const baseCurrency = setupRes.data.base_currency;
  const copy = getBalancesCopy();

  // 每个账户的最新快照
  const latestByAccount = new Map<string, BalanceDisplaySnapshot>();
  for (const snap of snapshots) {
    latestByAccount.set(snap.account_id, snap);
  }

  return (
    <div lang={locale} className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-stone-950">
          {copy.page.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {copy.page.description}
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
              locale={locale}
              baseCurrency={baseCurrency}
              observedTemplate={copy.card.observed}
            />
          ))}
        </div>
      )}

      {/* 余额录入 */}
      <BalanceForm
        accounts={accounts}
        baseCurrency={baseCurrency}
        defaultDate={localDate(setupRes.data.time_zone)}
        copy={copy.form}
        errorCopy={copy.errors}
      />

      {/* 趋势图 */}
      <BalanceHistoryChart
        accounts={accounts}
        snapshots={snapshots}
        locale={locale}
        baseCurrency={baseCurrency}
        copy={copy.history}
        errorCopy={copy.errors}
      />
    </div>
  );
}
