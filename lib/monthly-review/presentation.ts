import type { MonthlyReviewErrorCode } from "./contracts";
import { isChineseLocale } from "../i18n/locale";

export interface MonthlyReportCopy {
  page: { backAria: string; backTitle: string; title: string; description: string };
  stats: {
    executionCompletion: string;
    plannedTransfer: string;
    netValueChange: string;
    impulseAmount: string;
    decisions: string;
  };
  explanation: string;
  actions: { title: string; empty: string };
  balances: {
    title: string;
    account: string;
    earliest: string;
    latest: string;
    observedChange: string;
  };
}

export interface MonthlyReviewCopy {
  complete: {
    ariaLabel: string;
    label: string;
    title: string;
    description: string;
    openMonth: string;
  };
  review: {
    ariaLabel: string;
    label: string;
    title: string;
    description: string;
    progress: string;
    openPlan: string;
    closing: string;
    close: string;
    finishActions: string;
  };
  errors: Record<MonthlyReviewErrorCode, string>;
}

const ENGLISH_REPORT_COPY: MonthlyReportCopy = {
  page: {
    backAria: "Back to Progress",
    backTitle: "Back",
    title: "{month} Monthly report",
    description: "Plan, confirmations, and Balance Snapshot observations.",
  },
  stats: {
    executionCompletion: "Execution completion",
    plannedTransfer: "Planned transfer",
    netValueChange: "Net value change",
    impulseAmount: "Impulse amount",
    decisions: "{count} decisions",
  },
  explanation:
    "Execution status only reflects confirmations. Net value change comes from Balance Snapshots and stays independent from planned transfer.",
  actions: {
    title: "Monthly Action confirmations",
    empty: "No monthly actions for this month.",
  },
  balances: {
    title: "Balance Snapshot observations",
    account: "Account",
    earliest: "Earliest Balance Snapshot",
    latest: "Latest Balance Snapshot",
    observedChange: "Observed change",
  },
};

const CHINESE_REPORT_COPY: MonthlyReportCopy = {
  page: {
    backAria: "返回进展",
    backTitle: "返回",
    title: "{month} 月度报告",
    description: "查看计划、完成确认和余额快照观察。",
  },
  stats: {
    executionCompletion: "执行完成率",
    plannedTransfer: "计划转入",
    netValueChange: "净值变化",
    impulseAmount: "拦截金额",
    decisions: "{count} 次决定",
  },
  explanation: "执行状态只反映完成确认。净值变化来自余额快照，并与计划转入保持独立。",
  actions: {
    title: "月度行动确认",
    empty: "该月没有月度行动。",
  },
  balances: {
    title: "余额快照观察",
    account: "账户",
    earliest: "最早余额快照",
    latest: "最新余额快照",
    observedChange: "观察到的变化",
  },
};

const ENGLISH_REVIEW_COPY: MonthlyReviewCopy = {
  complete: {
    ariaLabel: "Monthly Review status",
    label: "Review complete",
    title: "{month} is closed.",
    description:
      "Monthly execution is preserved. Balance Snapshots remain observations and can still be corrected.",
    openMonth: "Open {month}",
  },
  review: {
    ariaLabel: "Complete Monthly Review",
    label: "Monthly Review",
    title: "Close {month}",
    description:
      "Closing preserves Monthly Action confirmations and prepares the current month. It does not confirm a bank balance or transfer.",
    progress: "{completed} of {total} Monthly Actions confirmed",
    openPlan: "Open Savings Plan",
    closing: "Closing…",
    close: "Close {month}",
    finishActions: "Finish Monthly Actions",
  },
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    INVALID_MONTH: "Reload the Monthly Review and try again.",
    MONTH_NOT_AVAILABLE: "This month is not available for Monthly Review.",
    ACTIONS_INCOMPLETE: "Finish every Monthly Action before closing this month.",
    PLAN_NOT_READY: "Add or reactivate a Plan Rule before closing this month.",
    REVIEW_FAILED: "The Monthly Review could not be completed. Try again.",
  },
};

const CHINESE_REVIEW_COPY: MonthlyReviewCopy = {
  complete: {
    ariaLabel: "月度复盘状态",
    label: "复盘完成",
    title: "{month} 已关闭。",
    description: "月度执行记录已保留。余额快照仍是观察记录，并且仍可更正。",
    openMonth: "打开 {month}",
  },
  review: {
    ariaLabel: "完成月度复盘",
    label: "月度复盘",
    title: "关闭 {month}",
    description: "关闭月份会保留月度行动确认并准备当前月份。该操作不确认银行余额或转账。",
    progress: "已确认 {completed}/{total} 个月度行动",
    openPlan: "打开储蓄计划",
    closing: "关闭中…",
    close: "关闭 {month}",
    finishActions: "完成月度行动",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_MONTH: "请重新加载月度复盘后再试。",
    MONTH_NOT_AVAILABLE: "该月份当前不能进行月度复盘。",
    ACTIONS_INCOMPLETE: "请先完成全部月度行动。",
    PLAN_NOT_READY: "请先添加或重新启用计划规则。",
    REVIEW_FAILED: "月度复盘未能完成，请重试。",
  },
};

export function getMonthlyReportCopy(locale: string | null | undefined): MonthlyReportCopy {
  return isChineseLocale(locale) ? CHINESE_REPORT_COPY : ENGLISH_REPORT_COPY;
}

export function getMonthlyReviewCopy(locale: string | null | undefined): MonthlyReviewCopy {
  return isChineseLocale(locale) ? CHINESE_REVIEW_COPY : ENGLISH_REVIEW_COPY;
}
