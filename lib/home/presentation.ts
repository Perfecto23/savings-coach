import type { HomeActionErrorCode } from "./contracts";
import { isChineseLocale } from "../i18n/locale";

export interface HomeCopy {
  language: string;
  page: { title: string; subtitle: string };
  activation: { title: string; description: string };
  needsPlan: { title: string; description: string; action: string };
  needsReview: {
    label: string;
    title: string;
    description: string;
    progress: string;
    reviewAction: string;
    finishAction: string;
  };
  repair: { title: string; description: string; action: string };
  ready: {
    ariaLabel: string;
    title: string;
    overdueSince: string;
    dueToday: string;
    due: string;
    transferFrom: string;
    transferTo: string;
    description: string;
    confirmAria: string;
    confirming: string;
    confirm: string;
  };
  complete: {
    title: string;
    description: string;
    openPlan: string;
    undoAria: string;
    undoing: string;
    undo: string;
  };
  progress: {
    ariaLabel: string;
    title: string;
    count: string;
    undoAria: string;
    undoLast: string;
  };
  planSummary: {
    ariaLabel: string;
    title: string;
    plannedThisMonth: string;
    targetBalance: string;
    description: string;
  };
  errors: Record<HomeActionErrorCode, string>;
}

const ENGLISH_COPY: HomeCopy = {
  language: "en",
  page: { title: "This month", subtitle: "{month} · One clear action at a time." },
  activation: {
    title: "Your plan is now in motion.",
    description:
      "You confirmed your first Monthly Action. Your Plan Path remains a target, and your Balance Snapshots remain separate.",
  },
  needsPlan: {
    title: "Build your Savings Plan",
    description: "Add a Plan Rule and activate it to see this month's action here.",
    action: "Open Savings Plan",
  },
  needsReview: {
    label: "Monthly Review",
    title: "Review {reviewMonth} before starting {currentMonth}.",
    description:
      "Closing preserves the month's execution record. Balance Snapshots remain observations and can be added or corrected later.",
    progress: "{completed} of {total} Monthly Actions confirmed",
    reviewAction: "Review {month}",
    finishAction: "Finish {month}",
  },
  repair: {
    title: "Your Monthly Actions need attention.",
    description:
      "The active Plan Path has no usable action for this month. Open your Savings Plan and activate it again.",
    action: "Open Savings Plan",
  },
  ready: {
    ariaLabel: "Next Monthly Action",
    title: "Your next Monthly Action",
    overdueSince: "Overdue since {date}",
    dueToday: "Due today",
    due: "Due {date}",
    transferFrom: "From {source} to {target}",
    transferTo: "To {target}",
    description:
      "Complete it manually, then confirm it here. Savings Coach does not move money or verify a bank transfer.",
    confirmAria: "Confirm completion for {name}",
    confirming: "Confirming…",
    confirm: "I completed this",
  },
  complete: {
    title: "This month's Monthly Actions are complete.",
    description:
      "You confirmed {completed} of {total} actions. Your Monthly Review will open after this natural month ends.",
    openPlan: "Open Savings Plan",
    undoAria: "Undo confirmation for {name}",
    undoing: "Undoing…",
    undo: "Undo confirmation",
  },
  progress: {
    ariaLabel: "Monthly Action progress",
    title: "Monthly Action progress",
    count: "{completed} of {total} Monthly Actions confirmed",
    undoAria: "Undo confirmation for {name}",
    undoLast: "Undo last confirmation",
  },
  planSummary: {
    ariaLabel: "Plan Path summary",
    title: "Plan Path",
    plannedThisMonth: "Planned this month",
    targetBalance: "Target balance",
    description:
      "Plan Path is a target. Balance Snapshots and net value remain separate.",
  },
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    ACTION_NOT_FOUND: "This Monthly Action is no longer available. Reload Home.",
    INVALID_ACTION: "Reload Home and try again.",
    MONTH_CLOSED: "This month is closed. Its Monthly Actions cannot be changed.",
    ACTION_UPDATE_FAILED: "The Monthly Action could not be updated. Try again.",
  },
};

const CHINESE_COPY: HomeCopy = {
  language: "zh-CN",
  page: { title: "本月", subtitle: "{month} · 每次只做一件明确的事。" },
  activation: {
    title: "储蓄计划已经开始执行。",
    description: "你已确认首个月度行动。计划路径仍是目标，余额快照仍单独记录。",
  },
  needsPlan: {
    title: "建立储蓄计划",
    description: "添加计划规则并激活计划，即可在这里查看本月行动。",
    action: "打开储蓄计划",
  },
  needsReview: {
    label: "月度复盘",
    title: "先复盘 {reviewMonth}，再开始 {currentMonth}。",
    description: "关闭月份会保留当月执行记录。余额快照仍可在之后补录或更正。",
    progress: "已确认 {completed}/{total} 个月度行动",
    reviewAction: "复盘 {month}",
    finishAction: "完成 {month}",
  },
  repair: {
    title: "月度行动需要处理。",
    description: "当前计划路径没有可执行的本月行动。请打开储蓄计划并重新激活。",
    action: "打开储蓄计划",
  },
  ready: {
    ariaLabel: "下一月度行动",
    title: "下一行动",
    overdueSince: "自 {date} 起逾期",
    dueToday: "今天到期",
    due: "{date} 到期",
    transferFrom: "从 {source} 到 {target}",
    transferTo: "到 {target}",
    description: "请手工完成行动，再在这里确认。储蓄教练不转移资金，也不验证银行转账。",
    confirmAria: "确认已完成{name}",
    confirming: "确认中…",
    confirm: "我已完成",
  },
  complete: {
    title: "本月行动已全部完成。",
    description: "你已确认 {completed}/{total} 个行动。自然月结束后即可开始月度复盘。",
    openPlan: "打开储蓄计划",
    undoAria: "撤销{name}的完成确认",
    undoing: "撤销中…",
    undo: "撤销确认",
  },
  progress: {
    ariaLabel: "月度行动进度",
    title: "月度行动进度",
    count: "已确认 {completed}/{total} 个月度行动",
    undoAria: "撤销{name}的完成确认",
    undoLast: "撤销上次确认",
  },
  planSummary: {
    ariaLabel: "计划路径摘要",
    title: "计划路径",
    plannedThisMonth: "本月计划转入",
    targetBalance: "目标余额",
    description: "计划路径只表示目标。余额快照与净值变化仍单独记录。",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    ACTION_NOT_FOUND: "该月度行动已不可用。请重新加载首页。",
    INVALID_ACTION: "请重新加载首页后再试。",
    MONTH_CLOSED: "该月份已关闭，不能再修改月度行动。",
    ACTION_UPDATE_FAILED: "月度行动更新失败，请重试。",
  },
};

export function getHomeCopy(locale: string | null | undefined): HomeCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
