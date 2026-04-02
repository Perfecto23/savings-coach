import type { MonthlyMilestone, SopRecord } from "@/lib/types/database";

export function getCurrentYearMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getMilestoneSnapshotForTemplate(params: {
  toAccountId: string | null;
  defaultAmount: number | null | undefined;
  accountPurposeById: Map<string, string>;
}) {
  const amount =
    params.defaultAmount == null ? null : roundMoney(Number(params.defaultAmount));
  const countsTowardMilestone =
    params.toAccountId != null &&
    params.accountPurposeById.get(params.toAccountId) === "savings" &&
    amount != null &&
    amount > 0;

  return {
    counts_toward_milestone: countsTowardMilestone,
    milestone_amount: countsTowardMilestone ? amount : null,
  };
}

export function sumMilestoneTarget(records: Array<Pick<SopRecord, "counts_toward_milestone" | "milestone_amount">>) {
  return roundMoney(
    records.reduce((sum, record) => {
      if (!record.counts_toward_milestone || record.milestone_amount == null) {
        return sum;
      }
      return sum + Number(record.milestone_amount);
    }, 0)
  );
}

export function getMilestoneStatus(params: {
  yearMonth: string;
  currentYearMonth: string;
  records: Array<Pick<SopRecord, "completed" | "counts_toward_milestone" | "milestone_amount">>;
}): MonthlyMilestone["status"] {
  const targetRecords = params.records.filter(
    (record) =>
      record.counts_toward_milestone &&
      record.milestone_amount != null &&
      Number(record.milestone_amount) > 0
  );

  if (targetRecords.length === 0) {
    return params.yearMonth < params.currentYearMonth ? "on_track" : "pending";
  }

  if (targetRecords.every((record) => record.completed)) {
    return "on_track";
  }

  return params.yearMonth < params.currentYearMonth ? "missed" : "pending";
}
