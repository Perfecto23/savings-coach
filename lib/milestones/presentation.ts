import { isChineseLocale } from "../i18n/locale";

export type MilestoneDeleteErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_MONTH"
  | "DELETE_FAILED"
  | "PLAN_PATH_PROTECTED";

export type MilestoneDeleteResult =
  | { success: true; data: undefined }
  | { success: false; error: MilestoneDeleteErrorCode };

export interface MilestonesCopy {
  page: { title: string; description: string };
  table: {
    statusPending: string;
    statusComplete: string;
    statusIncomplete: string;
    deleteConfirm: string;
    empty: string;
    explanation: string;
    month: string;
    plannedTransfer: string;
    targetBalance: string;
    netValueChange: string;
    balanceSnapshotTotal: string;
    executionStatus: string;
    bonusEvents: string;
    report: string;
    current: string;
    reviewed: string;
    openReportAria: string;
    open: string;
    delete: string;
    deleteErrors: Record<MilestoneDeleteErrorCode, string>;
  };
}

const ENGLISH_COPY: MilestonesCopy = {
  page: {
    title: "Progress",
    description:
      "Compare your Plan Path, Balance Snapshot observations, and execution status without treating them as the same result.",
  },
  table: {
    statusPending: "Execution pending",
    statusComplete: "Execution complete",
    statusIncomplete: "Execution incomplete",
    deleteConfirm: "Delete the legacy Monthly Milestone for {month}?",
    empty: "No Progress data yet. Activate a Savings Plan to create a Plan Path.",
    explanation:
      "Execution status only reflects Monthly Action confirmations. Net value change comes from Balance Snapshots and can include transfers, withdrawals, or market movement.",
    month: "Month",
    plannedTransfer: "Planned transfer",
    targetBalance: "Target balance",
    netValueChange: "Net value change",
    balanceSnapshotTotal: "Balance Snapshot total",
    executionStatus: "Execution status",
    bonusEvents: "Bonus events",
    report: "Report",
    current: "Current",
    reviewed: "Reviewed",
    openReportAria: "Open monthly report",
    open: "Open",
    delete: "Delete",
    deleteErrors: {
      UNAUTHENTICATED: "Please sign in again.",
      INVALID_MONTH: "Choose a valid month and try again.",
      DELETE_FAILED: "The legacy Monthly Milestone could not be deleted.",
      PLAN_PATH_PROTECTED: "Plan Path nodes cannot be deleted.",
    },
  },
};

const CHINESE_COPY: MilestonesCopy = {
  page: {
    title: "进展",
    description: "对比计划路径、余额快照观察和执行状态，但不要把三者视为同一结果。",
  },
  table: {
    statusPending: "等待执行",
    statusComplete: "执行完成",
    statusIncomplete: "执行未完成",
    deleteConfirm: "删除 {month} 的旧月度里程碑？",
    empty: "还没有进展数据。激活储蓄计划后会生成计划路径。",
    explanation:
      "执行状态只反映月度行动确认。净值变化来自余额快照，可能包含转入、取出或市场波动。",
    month: "月份",
    plannedTransfer: "计划转入",
    targetBalance: "目标余额",
    netValueChange: "净值变化",
    balanceSnapshotTotal: "余额快照合计",
    executionStatus: "执行状态",
    bonusEvents: "奖金事件",
    report: "报告",
    current: "当前",
    reviewed: "已复盘",
    openReportAria: "打开月度报告",
    open: "打开",
    delete: "删除",
    deleteErrors: {
      UNAUTHENTICATED: "请重新登录。",
      INVALID_MONTH: "请选择有效月份后重试。",
      DELETE_FAILED: "旧月度里程碑删除失败，请重试。",
      PLAN_PATH_PROTECTED: "计划路径节点不能删除。",
    },
  },
};

export function getMilestonesCopy(locale: string | null | undefined): MilestonesCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
