import type {
  Account,
  BalanceSnapshot,
  MonthlyMilestone,
  SopRecord,
  ImpulseLog,
} from "@/lib/types/database";

export type MonthlyReportAccount = Pick<Account, "id" | "name" | "icon">;
export type MonthlyReportSnapshot = Pick<
  BalanceSnapshot,
  "account_id" | "recorded_at" | "balance"
>;
export type MonthlyReportMilestone = Pick<
  MonthlyMilestone,
  | "year_month"
  | "planned_savings"
  | "actual_savings"
  | "is_plan_path"
  | "review_completed_at"
>;
export type MonthlyReportSopRecord = Pick<
  SopRecord,
  "id" | "step_label" | "completed" | "amount" | "scheduled_for"
>;
export type MonthlyReportImpulse = Pick<
  ImpulseLog,
  "estimated_price" | "resisted" | "logged_at"
>;

export interface MonthlyReportData {
  yearMonth: string;
  milestone: MonthlyReportMilestone | null;
  sopRecords: MonthlyReportSopRecord[];
  sopCompletionRate: number;
  accountBalances: Array<{
    account: MonthlyReportAccount;
    startBalance: number | null;
    endBalance: number | null;
    change: number | null;
  }>;
  impulseTotal: number;
  impulseCount: number;
}

export function generateReportData(params: {
  yearMonth: string;
  accounts: MonthlyReportAccount[];
  snapshots: MonthlyReportSnapshot[];
  milestone: MonthlyReportMilestone | null;
  sopRecords: MonthlyReportSopRecord[];
  impulseLogs: MonthlyReportImpulse[];
}): MonthlyReportData {
  const { yearMonth, accounts, snapshots, milestone, sopRecords, impulseLogs } =
    params;

  // SOP 完成率
  const sopTotal = sopRecords.length;
  const sopDone = sopRecords.filter((r) => r.completed).length;
  const sopCompletionRate = sopTotal > 0 ? Math.round((sopDone / sopTotal) * 100) : 0;

  const accountBalances = accounts.map((account) => {
    const acctSnaps = snapshots
      .filter((s) => s.account_id === account.id)
      .toSorted((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const monthStart = `${yearMonth}-01`;
    const monthSnaps = acctSnaps.filter((s) => s.recorded_at.startsWith(yearMonth));
    const previousSnaps = acctSnaps.filter((s) => s.recorded_at < monthStart);
    const startSnapshot =
      previousSnaps.at(-1) ?? (monthSnaps.length > 1 ? monthSnaps[0] : undefined);
    const endSnapshot = monthSnaps.at(-1);
    const startBalance = startSnapshot?.balance ?? null;
    const endBalance = endSnapshot?.balance ?? null;
    const change =
      startBalance != null && endBalance != null
        ? endBalance - startBalance
        : null;

    return { account, startBalance, endBalance, change };
  });

  // 冲动拦截统计
  const monthLogs = impulseLogs.filter(
    (l) => l.logged_at.startsWith(yearMonth) && l.resisted
  );
  const impulseTotal = monthLogs.reduce(
    (sum, l) => sum + l.estimated_price,
    0
  );

  return {
    yearMonth,
    milestone,
    sopRecords,
    sopCompletionRate,
    accountBalances,
    impulseTotal,
    impulseCount: monthLogs.length,
  };
}
