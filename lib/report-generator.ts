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

  // 按账户聚合余额变化
  const monthSnapshots = snapshots.filter((s) =>
    s.recorded_at.startsWith(yearMonth)
  );

  const accountBalances = accounts.map((account) => {
    const acctSnaps = monthSnapshots
      .filter((s) => s.account_id === account.id)
      .toSorted((a, b) => a.recorded_at.localeCompare(b.recorded_at));

    const startBalance = acctSnaps.length > 0 ? acctSnaps[0].balance : null;
    const endBalance =
      acctSnaps.length > 0 ? acctSnaps[acctSnaps.length - 1].balance : null;
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
