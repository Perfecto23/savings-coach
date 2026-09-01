import type { HomeActionErrorCode } from "./contracts";

export interface HomeCopy {
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

const COPY: HomeCopy = {
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

export function getHomeCopy(): HomeCopy {
  return COPY;
}
