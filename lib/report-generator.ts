import type {
  Account,
  BalanceSnapshot,
  MonthlyMilestone,
  SopRecord,
  ImpulseLog,
} from "@/lib/types/database";

export interface MonthlyReportData {
  yearMonth: string;
  milestone: MonthlyMilestone | null;
  sopRecords: SopRecord[];
  sopCompletionRate: number;
  accountBalances: Array<{
    account: Account;
    startBalance: number | null;
    endBalance: number | null;
    change: number | null;
  }>;
  impulseTotal: number;
  impulseCount: number;
}

export function generateReportData(params: {
  yearMonth: string;
  accounts: Account[];
  snapshots: BalanceSnapshot[];
  milestone: MonthlyMilestone | null;
  sopRecords: SopRecord[];
  impulseLogs: ImpulseLog[];
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
