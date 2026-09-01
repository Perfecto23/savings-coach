import type { BalanceSnapshot } from "../types/database";

export type BalanceActionErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_DATE"
  | "EMPTY_OBSERVATIONS"
  | "INVALID_ACCOUNT"
  | "INVALID_BALANCE"
  | "DUPLICATE_ACCOUNT"
  | "OBSERVATION_NOT_FOUND"
  | "SETUP_OBSERVATION_REQUIRED"
  | "ACCOUNT_NOT_FOUND"
  | "PLAN_PATH_INCOMPLETE"
  | "SAVE_FAILED"
  | "DELETE_FAILED"
  | "LOAD_FAILED";

export type BalanceMutationResult =
  | { success: true; data: undefined }
  | { success: false; error: BalanceActionErrorCode };

export type BalanceHistoryResult =
  | { success: true; data: BalanceSnapshot[] }
  | { success: false; error: BalanceActionErrorCode };

export interface BalancesCopy {
  page: { title: string; description: string };
  card: { observed: string };
  form: {
    title: string;
    description: string;
    dateLabel: string;
    balancePlaceholder: string;
    balanceAria: string;
    success: string;
    saving: string;
    submit: string;
  };
  history: {
    title: string;
    empty: string;
    threeMonths: string;
    sixMonths: string;
    all: string;
    deleteConfirm: string;
    deleteAria: string;
  };
  errors: Record<BalanceActionErrorCode, string>;
}

const COPY: BalancesCopy = {
  page: {
    title: "余额快照",
    description: "记录你观察到的余额。储蓄教练不验证银行余额。",
  },
  card: { observed: "观察于 {date}" },
  form: {
    title: "记录余额快照",
    description: "该操作保存你的余额观察，不表示银行余额已确认。",
    dateLabel: "观察日期",
    balancePlaceholder: "观察到的余额",
    balanceAria: "{account}的余额快照",
    success: "余额快照已保存。储蓄教练不验证银行余额。",
    saving: "保存中…",
    submit: "保存余额快照",
  },
  history: {
    title: "余额快照历史",
    empty: "还没有余额快照。",
    threeMonths: "近 3 个月",
    sixMonths: "近 6 个月",
    all: "全部",
    deleteConfirm: "删除 {date} 观察到的全部余额快照？",
    deleteAria: "删除 {date} 的余额快照",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_DATE: "请选择不晚于今天的有效观察日期。",
    EMPTY_OBSERVATIONS: "请至少输入一个有效的余额快照。",
    INVALID_ACCOUNT: "请检查每个余额快照后重试。",
    INVALID_BALANCE: "余额必须为非负数，且最多保留两位小数。",
    DUPLICATE_ACCOUNT: "同一观察日期内，每个账户只能出现一次。",
    OBSERVATION_NOT_FOUND: "该观察日期没有余额快照。",
    SETUP_OBSERVATION_REQUIRED: "设置中的储蓄账户必须至少保留一个余额快照。",
    ACCOUNT_NOT_FOUND: "找不到其中一个所选账户。",
    PLAN_PATH_INCOMPLETE: "计划路径需要处理后才能修改余额快照。",
    SAVE_FAILED: "余额快照保存失败，请重试。",
    DELETE_FAILED: "余额快照删除失败，请重试。",
    LOAD_FAILED: "余额快照历史加载失败，请重试。",
  },
};

export function getBalancesCopy(): BalancesCopy {
  return COPY;
}
