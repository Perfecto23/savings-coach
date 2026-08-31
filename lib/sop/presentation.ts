import { isChineseLocale } from "@/lib/i18n/locale";

export interface SopCopy {
  page: {
    title: string;
    description: string;
    monthAriaLabel: string;
  };
  checklist: {
    loading: string;
    emptyBeforeLink: string;
    emptyLink: string;
    emptyAfterLink: string;
    closed: string;
    progress: string;
    celebrationTitle: string;
    celebrationDescription: string;
    dayPrefix: string;
    daySuffix: string;
    addTemporaryTitle: string;
    temporaryNamePlaceholder: string;
    temporaryNameAria: string;
    dueDay: string;
    amountOptional: string;
    amount: string;
    noteOptional: string;
    note: string;
    cancel: string;
    add: string;
    addTemporary: string;
  };
  step: {
    completedClosed: string;
    incompleteClosed: string;
    markIncomplete: string;
    markComplete: string;
    temporary: string;
    monthlyActionAmount: string;
    cancel: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    completedAt: string;
    note: string;
    amount: string;
    save: string;
    monthlyActionHelp: string;
  };
  errors: Record<string, string>;
}

const ENGLISH_COPY: SopCopy = {
  page: {
    title: "Monthly SOP",
    description: "Follow your monthly savings process step by step.",
    monthAriaLabel: "Choose month",
  },
  checklist: {
    loading: "Loading monthly SOP…",
    emptyBeforeLink: "No SOP template yet. Configure one in",
    emptyLink: "Settings",
    emptyAfterLink: ".",
    closed:
      "This month is closed. Its execution record cannot be changed. Balance Snapshots remain observations and can still be corrected.",
    progress: "This month’s progress",
    celebrationTitle: "This month’s SOP is complete!",
    celebrationDescription: "Good work. Keep going.",
    dayPrefix: "Day",
    daySuffix: "of each month",
    addTemporaryTitle: "Add a temporary step",
    temporaryNamePlaceholder: "Step name, for example move funds between accounts",
    temporaryNameAria: "Temporary step name",
    dueDay: "Due day",
    amountOptional: "Amount (optional)",
    amount: "Amount",
    noteOptional: "Note (optional)",
    note: "Note",
    cancel: "Cancel",
    add: "Add",
    addTemporary: "Add a temporary step",
  },
  step: {
    completedClosed: "Completed in closed month",
    incompleteClosed: "Incomplete in closed month",
    markIncomplete: "Mark as incomplete",
    markComplete: "Mark as complete",
    temporary: "Temporary",
    monthlyActionAmount: "Monthly Action amount",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this temporary step?",
    completedAt: "Completed at",
    note: "Note",
    amount: "Amount",
    save: "Save",
    monthlyActionHelp:
      "This adjusts this month’s plan. It does not record an actual bank transfer.",
  },
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    INVALID_MONTH: "Choose a valid month.",
    LOAD_FAILED: "Monthly SOP could not be loaded. Try again.",
    INVALID_ID: "The monthly SOP step was invalid.",
    NOT_FOUND: "Monthly SOP step was not found.",
    UPDATE_FAILED: "Monthly SOP step could not be updated. Try again.",
    INVALID_LABEL: "Enter a step name.",
    INVALID_DAY: "Due day must be between 1 and 31.",
    INVALID_AMOUNT: "Enter a valid non-negative amount.",
    DELETE_FORBIDDEN: "Manage template steps in Settings.",
    INVALID_NOTE: "Note must be 1,000 characters or fewer.",
    SAVE_FAILED: "Changes could not be saved. Try again.",
  },
};

const CHINESE_COPY: SopCopy = {
  page: {
    title: "月度 SOP",
    description: "按步骤执行每月储蓄流程。",
    monthAriaLabel: "选择月份",
  },
  checklist: {
    loading: "正在加载月度 SOP…",
    emptyBeforeLink: "还没有 SOP 模板，请先在",
    emptyLink: "设置",
    emptyAfterLink: "中配置。",
    closed:
      "该月份已关闭，执行记录不能修改。余额快照仍是余额观察，可以继续更正。",
    progress: "本月进度",
    celebrationTitle: "本月 SOP 全部完成！",
    celebrationDescription: "完成得很好，请继续保持。",
    dayPrefix: "每月",
    daySuffix: "号",
    addTemporaryTitle: "添加临时步骤",
    temporaryNamePlaceholder: "步骤名称，例如在账户间匀钱",
    temporaryNameAria: "临时步骤名称",
    dueDay: "执行日",
    amountOptional: "金额（选填）",
    amount: "金额",
    noteOptional: "备注（选填）",
    note: "备注",
    cancel: "取消",
    add: "添加",
    addTemporary: "添加临时步骤",
  },
  step: {
    completedClosed: "已在关闭月份完成",
    incompleteClosed: "关闭月份中未完成",
    markIncomplete: "标记为未完成",
    markComplete: "标记为完成",
    temporary: "临时",
    monthlyActionAmount: "月度行动金额",
    cancel: "取消",
    edit: "编辑",
    delete: "删除",
    deleteConfirm: "确定删除此临时步骤？",
    completedAt: "完成于",
    note: "备注",
    amount: "金额",
    save: "保存",
    monthlyActionHelp: "这会调整本月计划，不会记录实际银行转账。",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_MONTH: "请选择有效月份。",
    LOAD_FAILED: "无法加载月度 SOP，请重试。",
    INVALID_ID: "月度 SOP 步骤无效。",
    NOT_FOUND: "找不到该月度 SOP 步骤。",
    UPDATE_FAILED: "无法更新月度 SOP 步骤，请重试。",
    INVALID_LABEL: "请输入步骤名称。",
    INVALID_DAY: "执行日必须在 1 到 31 之间。",
    INVALID_AMOUNT: "请输入有效的非负金额。",
    DELETE_FORBIDDEN: "请在设置中管理模板步骤。",
    INVALID_NOTE: "备注不能超过 1,000 个字符。",
    SAVE_FAILED: "保存失败，请重试。",
  },
};

export function getSopCopy(locale: string | null | undefined): SopCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}

export function getSopErrorMessage(error: string, errors: Record<string, string>) {
  return errors[error] ?? errors.SAVE_FAILED;
}
