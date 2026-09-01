import type { AppLocale } from "@/lib/product-locale";
import type { PlanFormErrorCode, PlanFormSuccessCode } from "./contracts";

export interface PlanCopy {
  locale: AppLocale;
  page: {
    title: string;
    description: string;
    currentActionsLabel: string;
    currentActionsTitle: string;
    currentActionsDescription: string;
    currentActionsEmpty: string;
    duePrefix: string;
    noSourceAccount: string;
    overdue: string;
    completed: string;
  };
  createForm: {
    regionLabel: string;
    title: string;
    description: string;
    nameLabel: string;
    namePlaceholder: string;
    amountLabel: string;
    amountHelp: string;
    dueDayLabel: string;
    dueDayHelp: string;
    sourceAccountLabel: string;
    noSourceAccount: string;
    targetAccountLabel: string;
    submit: string;
    submitting: string;
  };
  editForm: {
    title: string;
    description: string;
    nameLabel: string;
    amountLabel: string;
    dueDayLabel: string;
    sourceAccountLabel: string;
    noSourceAccount: string;
    targetAccountLabel: string;
    cancel: string;
    submit: string;
    submitting: string;
  };
  ruleList: {
    regionLabel: string;
    title: string;
    description: string;
    addAnother: string;
    active: string;
    inactive: string;
    onDayPrefix: string;
    dueDaySuffix: string;
    edit: string;
    deactivate: string;
    reactivate: string;
    cancel: string;
  };
  activation: {
    activeTitle: string;
    activeSummary: string;
    nextAction: string;
    currentActionsComplete: string;
    safetyNote: string;
    title: string;
    description: string;
    submit: string;
    submitting: string;
    disabledHelp: string;
  };
  path: {
    regionLabel: string;
    title: string;
    description: string;
    monthsSuffix: string;
    empty: string;
    current: string;
    plannedThisMonthSuffix: string;
  };
  errorMessages: Record<PlanFormErrorCode, string>;
  successMessages: Record<PlanFormSuccessCode, string>;
}

const COPY: PlanCopy = {
  locale: "zh-CN",
  page: {
    title: "建立你的储蓄计划",
    description:
      "设定每月储蓄意图，生成月度行动，并查看后续计划路径。不需要收入数据，也不需要连接银行。",
    currentActionsLabel: "本月行动",
    currentActionsTitle: "本月行动",
    currentActionsDescription: "每项行动保留创建当月的计划规则金额和账户名称。",
    currentActionsEmpty: "激活储蓄计划后，系统会创建本月行动。",
    duePrefix: "到期日",
    noSourceAccount: "不指定来源账户",
    overdue: "已逾期",
    completed: "已完成",
  },
  createForm: {
    regionLabel: "添加计划规则",
    title: "添加计划规则",
    description:
      "选择每月计划转入的一个金额。储蓄教练只记录行动，不会执行资金转移。",
    nameLabel: "规则名称",
    namePlaceholder: "每月储蓄转入",
    amountLabel: "规则金额",
    amountHelp: "请输入正数，金额使用基础货币。",
    dueDayLabel: "到期日",
    dueDayHelp: "短月会使用当月最后一天。",
    sourceAccountLabel: "来源账户（可选）",
    noSourceAccount: "不指定来源账户",
    targetAccountLabel: "目标账户",
    submit: "添加规则",
    submitting: "添加中…",
  },
  editForm: {
    title: "编辑计划规则",
    description: "修改只影响未来月份。本月月度行动会保留原来的规则金额。",
    nameLabel: "规则名称",
    amountLabel: "规则金额",
    dueDayLabel: "到期日",
    sourceAccountLabel: "来源账户（可选）",
    noSourceAccount: "不指定来源账户",
    targetAccountLabel: "目标账户",
    cancel: "取消",
    submit: "保存修改",
    submitting: "保存中…",
  },
  ruleList: {
    regionLabel: "计划规则",
    title: "计划规则",
    description: "每条启用的计划规则会在每个自然月生成一项月度行动。",
    addAnother: "添加另一条规则",
    active: "已启用",
    inactive: "已停用",
    onDayPrefix: "每月",
    dueDaySuffix: "日",
    edit: "编辑",
    deactivate: "停用",
    reactivate: "重新启用",
    cancel: "取消",
  },
  activation: {
    activeTitle: "你的储蓄计划已激活。",
    activeSummary: "你计划每月向 {account} 转入 {amount}。",
    nextAction: "下一项行动的到期日是 {date}。",
    currentActionsComplete: "本月月度行动已全部完成。",
    safetyNote:
      "这是基于你的记录生成的计划。储蓄教练不会转移资金，也不保证未来余额。",
    title: "将计划规则转为本月行动",
    description:
      "激活会创建本月月度行动和 12 个月计划路径。重复激活不会生成重复记录。",
    submit: "激活储蓄计划",
    submitting: "激活中…",
    disabledHelp: "请先添加至少一条启用的计划规则。",
  },
  path: {
    regionLabel: "计划路径",
    title: "计划路径",
    description: "根据最近一次余额快照和计划转入，生成未来 12 个月的目标余额。该路径不是预测。",
    monthsSuffix: "个月",
    empty: "激活储蓄计划后，系统会创建计划路径。",
    current: "当前",
    plannedThisMonthSuffix: "本月计划转入",
  },
  errorMessages: {
    UNAUTHENTICATED: "请重新登录。",
    SETUP_INCOMPLETE: "请先完成设置，再建立储蓄计划。",
    INVALID_RULE: "请检查计划规则字段后重试。",
    RULE_NOT_FOUND: "该计划规则已不存在。请刷新页面。",
    ACCOUNT_NOT_FOUND: "未找到所选来源账户。",
    TARGET_ACCOUNT_MISMATCH: "目标账户必须与设置中的储蓄账户一致。",
    PLAN_HAS_NO_RULES: "激活前请添加至少一条启用的计划规则。",
    PLAN_SAVE_FAILED: "无法保存计划规则。请重试。",
    PLAN_ACTIVATION_FAILED: "无法激活储蓄计划。请重试。",
  },
  successMessages: {
    PLAN_RULE_ADDED: "计划规则已添加。",
    PLAN_RULE_UPDATED: "计划规则已更新。",
    PLAN_RULE_REACTIVATED: "计划规则已重新启用。",
    PLAN_RULE_DEACTIVATED: "计划规则已停用。",
    SAVINGS_PLAN_ACTIVATED: "储蓄计划已激活。",
  },
};

export function getPlanCopy(): PlanCopy {
  return COPY;
}
