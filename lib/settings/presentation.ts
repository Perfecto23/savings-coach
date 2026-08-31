import type { AccountPurpose } from "@/lib/types/database";
import { isChineseLocale } from "@/lib/i18n/locale";

export type SettingsActionErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_ACCOUNT_NAME"
  | "INVALID_ACCOUNT_PURPOSE"
  | "ACCOUNT_NOT_FOUND"
  | "SETUP_ACCOUNT_PROTECTED"
  | "BALANCE_HISTORY_PROTECTED"
  | "INVALID_STEP_NAME"
  | "INVALID_DUE_DAY"
  | "TEMPLATE_NOT_FOUND"
  | "SAVE_FAILED";

export interface SettingsCopy {
  page: {
    title: string;
    description: string;
    descriptionWithEmail: string;
  };
  tabs: {
    accounts: string;
    sop: string;
    email: string;
    emailAria: string;
    sectionsAria: string;
  };
  accountForm: {
    name: string;
    namePlaceholder: string;
    institution: string;
    institutionPlaceholder: string;
    purpose: string;
    icon: string;
    purposes: Record<AccountPurpose, string>;
    cancel: string;
    saving: string;
    update: string;
    add: string;
  };
  accounts: {
    empty: string;
    icon: string;
    name: string;
    institution: string;
    purpose: string;
    actions: string;
    edit: string;
    delete: string;
    editTitle: string;
    addTitle: string;
    add: string;
    deleteConfirm: string;
  };
  sopForm: {
    stepKey: string;
    stepKeyPlaceholder: string;
    stepLabel: string;
    stepLabelPlaceholder: string;
    dueDay: string;
    sourceAccount: string;
    targetAccount: string;
    none: string;
    defaultAmount: string;
    optional: string;
    enabled: string;
    cancel: string;
    saving: string;
    update: string;
    add: string;
  };
  templates: {
    empty: string;
    step: string;
    dueDay: string;
    route: string;
    amount: string;
    status: string;
    actions: string;
    monthlyDayPrefix: string;
    monthlyDaySuffix: string;
    enabled: string;
    disabled: string;
    edit: string;
    delete: string;
    editTitle: string;
    addTitle: string;
    add: string;
    deleteConfirm: string;
  };
  reminder: {
    title: string;
    description: string;
    enabled: string;
    disabled: string;
    schedulePrefix: string;
    scheduleSuffix: string;
    unsubscribing: string;
    unsubscribe: string;
    unsubscribeHelp: string;
    consent: string;
    scheduleSettingsSuffix: string;
    enabling: string;
    enable: string;
    successEnabled: string;
    successUnsubscribed: string;
    errors: Record<string, string>;
  };
  errors: Record<SettingsActionErrorCode, string>;
}

const ENGLISH_COPY: SettingsCopy = {
  page: {
    title: "Settings",
    description: "Manage accounts and SOP templates.",
    descriptionWithEmail: "Manage accounts, SOP templates, and email reminders.",
  },
  tabs: {
    accounts: "Accounts",
    sop: "SOP templates",
    email: "Email",
    emailAria: "Email reminders",
    sectionsAria: "Settings sections",
  },
  accountForm: {
    name: "Account name",
    namePlaceholder: "For example, salary account",
    institution: "Institution (optional)",
    institutionPlaceholder: "For example, your bank",
    purpose: "Purpose",
    icon: "Icon",
    purposes: {
      salary: "Salary",
      fixed_expense: "Fixed expenses",
      dating_fund: "Dating and leisure fund",
      savings: "Savings",
      flexible: "Flexible spending",
      housing_fund: "Housing fund",
    },
    cancel: "Cancel",
    saving: "Saving…",
    update: "Update",
    add: "Add",
  },
  accounts: {
    empty: "No accounts yet. Use the button below to add one.",
    icon: "Icon",
    name: "Name",
    institution: "Institution",
    purpose: "Purpose",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    editTitle: "Edit account",
    addTitle: "Add account",
    add: "+ Add account",
    deleteConfirm:
      "Delete this account? The Setup Savings Account and accounts with Balance Snapshots are protected. If deletion is allowed, SOP Template links are disconnected and historical Monthly Actions remain.",
  },
  sopForm: {
    stepKey: "Step key",
    stepKeyPlaceholder: "For example, transfer_savings",
    stepLabel: "Step name",
    stepLabelPlaceholder: "For example, move funds to savings",
    dueDay: "Due day",
    sourceAccount: "Source account",
    targetAccount: "Target account",
    none: "None",
    defaultAmount: "Default amount",
    optional: "Optional",
    enabled: "Enabled",
    cancel: "Cancel",
    saving: "Saving…",
    update: "Update",
    add: "Add",
  },
  templates: {
    empty: "No SOP templates yet. Use the button below to add one.",
    step: "Step",
    dueDay: "Due day",
    route: "Source → target",
    amount: "Amount",
    status: "Status",
    actions: "Actions",
    monthlyDayPrefix: "Day",
    monthlyDaySuffix: "of each month",
    enabled: "Enabled",
    disabled: "Disabled",
    edit: "Edit",
    delete: "Delete",
    editTitle: "Edit SOP step",
    addTitle: "Add SOP step",
    add: "+ Add SOP step",
    deleteConfirm: "Delete this SOP template?",
  },
  reminder: {
    title: "Monthly Review email reminder",
    description:
      "Receive one email when it is time to complete the previous month’s Monthly Review. The email never includes financial amounts, accounts, balances, or Monthly Actions.",
    enabled: "Enabled",
    disabled: "Disabled",
    schedulePrefix: "On the 2nd of each month at 09:00",
    scheduleSuffix: ".",
    unsubscribing: "Unsubscribing…",
    unsubscribe: "Unsubscribe from emails",
    unsubscribeHelp:
      "Unsubscribing blocks reminders that have not started dispatch. Once dispatch starts, that email may still arrive before Provider Acceptance is recorded.",
    consent:
      "I agree to receive a Monthly Review reminder email when my previous review is still open.",
    scheduleSettingsSuffix: "You can unsubscribe at any time in Settings.",
    enabling: "Enabling…",
    enable: "Enable email reminders",
    successEnabled: "Email reminders are enabled.",
    successUnsubscribed: "You are unsubscribed from email reminders.",
    errors: {
      FEATURE_DISABLED: "Email reminders are not available yet.",
      CONSENT_REQUIRED: "Agree to receive the Monthly Review email before enabling reminders.",
      INVALID_REQUEST: "The email reminder request was invalid. Reload Settings and try again.",
      UNAUTHENTICATED: "Please sign in again.",
      LOAD_FAILED: "Email reminder settings could not be loaded. Reload Settings and try again.",
      EMAIL_UNCONFIRMED: "Confirm your email address before enabling email reminders.",
      SETUP_INCOMPLETE: "Complete Setup before changing email reminders.",
      UPDATE_FAILED: "Email reminder settings could not be updated. Try again.",
      INVALID_RECEIPT: "Email reminder settings returned an invalid receipt. Reload Settings and try again.",
    },
  },
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    INVALID_ACCOUNT_NAME: "Enter an account name.",
    INVALID_ACCOUNT_PURPOSE: "Choose a valid account purpose.",
    ACCOUNT_NOT_FOUND: "Account was not found.",
    SETUP_ACCOUNT_PROTECTED: "Choose a different Setup Savings Account before deleting this account.",
    BALANCE_HISTORY_PROTECTED: "Delete this account’s Balance Snapshots before deleting the account.",
    INVALID_STEP_NAME: "Enter a step name.",
    INVALID_DUE_DAY: "Due day must be between 1 and 31.",
    TEMPLATE_NOT_FOUND: "SOP template was not found.",
    SAVE_FAILED: "Changes could not be saved. Try again.",
  },
};

const CHINESE_COPY: SettingsCopy = {
  page: {
    title: "设置",
    description: "管理账户和 SOP 模板。",
    descriptionWithEmail: "管理账户、SOP 模板和邮件提醒。",
  },
  tabs: {
    accounts: "账户管理",
    sop: "SOP 模板",
    email: "邮件提醒",
    emailAria: "邮件提醒",
    sectionsAria: "设置分类",
  },
  accountForm: {
    name: "账户名称",
    namePlaceholder: "例如：工资账户",
    institution: "银行或机构（选填）",
    institutionPlaceholder: "例如：开户银行",
    purpose: "账户用途",
    icon: "图标",
    purposes: {
      salary: "工资",
      fixed_expense: "固定开支",
      dating_fund: "恋爱享乐基金",
      savings: "储蓄",
      flexible: "弹性消费",
      housing_fund: "公积金",
    },
    cancel: "取消",
    saving: "保存中…",
    update: "更新",
    add: "添加",
  },
  accounts: {
    empty: "还没有账户，请使用下方按钮添加。",
    icon: "图标",
    name: "名称",
    institution: "机构",
    purpose: "用途",
    actions: "操作",
    edit: "编辑",
    delete: "删除",
    editTitle: "编辑账户",
    addTitle: "添加账户",
    add: "+ 添加账户",
    deleteConfirm:
      "确定删除此账户？初始设置中的储蓄账户和存在余额快照的账户受保护。允许删除时，SOP 模板会断开账户关联，历史月度行动会保留。",
  },
  sopForm: {
    stepKey: "步骤标识",
    stepKeyPlaceholder: "例如：transfer_savings",
    stepLabel: "步骤名称",
    stepLabelPlaceholder: "例如：转入储蓄账户",
    dueDay: "执行日",
    sourceAccount: "来源账户",
    targetAccount: "目标账户",
    none: "无",
    defaultAmount: "默认金额",
    optional: "选填",
    enabled: "启用",
    cancel: "取消",
    saving: "保存中…",
    update: "更新",
    add: "添加",
  },
  templates: {
    empty: "还没有 SOP 模板，请使用下方按钮添加。",
    step: "步骤",
    dueDay: "执行日",
    route: "来源 → 目标",
    amount: "金额",
    status: "状态",
    actions: "操作",
    monthlyDayPrefix: "每月",
    monthlyDaySuffix: "号",
    enabled: "启用",
    disabled: "禁用",
    edit: "编辑",
    delete: "删除",
    editTitle: "编辑 SOP 步骤",
    addTitle: "添加 SOP 步骤",
    add: "+ 添加 SOP 步骤",
    deleteConfirm: "确定删除此 SOP 模板？",
  },
  reminder: {
    title: "月度复盘邮件提醒",
    description:
      "上一月月度复盘待完成时，产品会发送一封提醒邮件。邮件不包含金额、账户、余额或月度行动。",
    enabled: "已启用",
    disabled: "已关闭",
    schedulePrefix: "每月 2 日 09:00",
    scheduleSuffix: "发送。",
    unsubscribing: "退订中…",
    unsubscribe: "退订邮件提醒",
    unsubscribeHelp:
      "退订会阻止尚未开始发送的提醒。发送开始后，该邮件仍可能在邮件服务商接受前到达。",
    consent: "我同意在上一月月度复盘仍未完成时接收提醒邮件。",
    scheduleSettingsSuffix: "你可以随时在设置中退订。",
    enabling: "启用中…",
    enable: "启用邮件提醒",
    successEnabled: "邮件提醒已启用。",
    successUnsubscribed: "邮件提醒已退订。",
    errors: {
      FEATURE_DISABLED: "邮件提醒尚未开放。",
      CONSENT_REQUIRED: "请先同意接收月度复盘提醒邮件。",
      INVALID_REQUEST: "邮件提醒请求无效，请刷新设置后重试。",
      UNAUTHENTICATED: "请重新登录。",
      LOAD_FAILED: "无法加载邮件提醒设置，请刷新后重试。",
      EMAIL_UNCONFIRMED: "请先确认邮箱地址。",
      SETUP_INCOMPLETE: "请先完成初始设置。",
      UPDATE_FAILED: "无法更新邮件提醒设置，请重试。",
      INVALID_RECEIPT: "邮件提醒返回结果无效，请刷新后重试。",
    },
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_ACCOUNT_NAME: "请输入账户名称。",
    INVALID_ACCOUNT_PURPOSE: "请选择有效的账户用途。",
    ACCOUNT_NOT_FOUND: "找不到该账户。",
    SETUP_ACCOUNT_PROTECTED: "请先更换初始设置中的储蓄账户。",
    BALANCE_HISTORY_PROTECTED: "请先删除该账户的余额快照。",
    INVALID_STEP_NAME: "请输入步骤名称。",
    INVALID_DUE_DAY: "执行日必须在 1 到 31 之间。",
    TEMPLATE_NOT_FOUND: "找不到该 SOP 模板。",
    SAVE_FAILED: "保存失败，请重试。",
  },
};

export function getSettingsCopy(locale: string | null | undefined): SettingsCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}

export function getSettingsErrorMessage(error: string, copy: SettingsCopy): string {
  return copy.errors[error as SettingsActionErrorCode] ?? copy.errors.SAVE_FAILED;
}
