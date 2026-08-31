import type {
  SetupBaseCurrency,
  SetupFormErrorCode,
  SetupLocale,
  SetupStep,
} from "./contracts";
import { isChineseLocale } from "@/lib/i18n/locale";

type VisibleSetupStep = Exclude<SetupStep, "complete">;

export interface SetupCopy {
  shell: {
    brand: string;
    signOut: string;
    title: string;
    description: string;
    steps: Record<VisibleSetupStep, { label: string; description: string }>;
    region: string;
    savingsAccount: string;
    startingBalance: string;
    privacy: string;
  };
  preferences: {
    checkpoint: string;
    title: string;
    description: string;
    language: string;
    timeZone: string;
    timeZoneHelp: string;
    baseCurrency: string;
    currencyLocked: string;
    currencyHelp: string;
    localeLabels: Record<SetupLocale, string>;
    currencyLabels: Record<SetupBaseCurrency, string>;
    saving: string;
    save: string;
  };
  account: {
    checkpoint: string;
    title: string;
    description: string;
    choice: string;
    useExisting: string;
    createNew: string;
    savingsAccount: string;
    existingHelp: string;
    accountName: string;
    accountPlaceholder: string;
    institution: string;
    institutionPlaceholder: string;
    saving: string;
    save: string;
  };
  balance: {
    checkpoint: string;
    title: string;
    descriptionBeforeAccount: string;
    descriptionAt: string;
    descriptionAfter: string;
    currentBalance: string;
    amountHelpBeforeCurrency: string;
    amountHelpAfterCurrency: string;
    balanceAsOf: string;
    todayBeforeTimeZone: string;
    todayBetween: string;
    saving: string;
    save: string;
  };
  complete: {
    brand: string;
    signOut: string;
    title: string;
    amountBefore: string;
    amountBetween: string;
    amountAfter: string;
    continue: string;
    boundary: string;
  };
  loading: string;
  errors: Record<SetupFormErrorCode, string>;
}

const ENGLISH_COPY: SetupCopy = {
  shell: {
    brand: "Savings Coach",
    signOut: "Sign out",
    title: "Set your savings starting point",
    description:
      "Three short checkpoints. About two minutes. No bank connection required.",
    steps: {
      preferences: {
        label: "Your region",
        description: "Language, time zone, and currency",
      },
      savingsAccount: {
        label: "Your savings account",
        description: "The account you want to grow",
      },
      initialBalance: {
        label: "Your current balance",
        description: "A starting point you can return to",
      },
    },
    region: "Region",
    savingsAccount: "Savings account",
    startingBalance: "Starting balance",
    privacy:
      "Your entries stay private to your account. Savings Coach records what you enter; it never moves money.",
  },
  preferences: {
    checkpoint: "Checkpoint 1 of 3",
    title: "Your region",
    description:
      "These settings keep dates and money readable. They do not connect a bank or move funds.",
    language: "Language and locale",
    timeZone: "Time zone",
    timeZoneHelp: "Used to decide which calendar day a balance belongs to.",
    baseCurrency: "Base currency",
    currencyLocked:
      "Your existing balance history uses CNY, so this value is locked.",
    currencyHelp:
      "All balances in this workspace use one currency. It locks after your first balance.",
    localeLabels: {
      "en-US": "English (United States)",
      "en-SG": "English (Singapore)",
      "zh-CN": "Simplified Chinese",
    },
    currencyLabels: {
      AUD: "AUD — Australian dollar",
      CAD: "CAD — Canadian dollar",
      CHF: "CHF — Swiss franc",
      CNY: "CNY — Chinese yuan",
      EUR: "EUR — Euro",
      GBP: "GBP — British pound",
      HKD: "HKD — Hong Kong dollar",
      NZD: "NZD — New Zealand dollar",
      SGD: "SGD — Singapore dollar",
      USD: "USD — US dollar",
    },
    saving: "Saving…",
    save: "Save and continue",
  },
  account: {
    checkpoint: "Checkpoint 2 of 3",
    title: "Your savings account",
    description:
      "Choose the account whose balance will mark your starting point. Never enter an account number or credential.",
    choice: "Account choice",
    useExisting: "Use an existing account",
    createNew: "Create a new account",
    savingsAccount: "Savings account",
    existingHelp: "Existing balance history stays unchanged.",
    accountName: "Account name",
    accountPlaceholder: "Rainy Day Fund",
    institution: "Institution (optional)",
    institutionPlaceholder: "Bank or provider",
    saving: "Saving…",
    save: "Save and continue",
  },
  balance: {
    checkpoint: "Checkpoint 3 of 3",
    title: "Your current balance",
    descriptionBeforeAccount: "Record what is in",
    descriptionAt: "at",
    descriptionAfter: ". This is a balance observation, not a transfer.",
    currentBalance: "Current balance",
    amountHelpBeforeCurrency: "Enter an amount in",
    amountHelpAfterCurrency: "Use no more than two decimal places.",
    balanceAsOf: "Balance as of",
    todayBeforeTimeZone: "Today in",
    todayBetween: "is",
    saving: "Saving…",
    save: "Save and continue",
  },
  complete: {
    brand: "Savings Coach",
    signOut: "Sign out",
    title: "Your starting point is saved",
    amountBefore: "You’re starting with",
    amountBetween: "in",
    amountAfter: ".",
    continue: "Continue to dashboard",
    boundary:
      "This confirms a balance you entered. It does not confirm a bank transaction.",
  },
  loading: "Loading your Setup…",
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    INVALID_LOCALE: "Choose a supported language.",
    INVALID_TIME_ZONE: "Choose a valid time zone.",
    INVALID_BASE_CURRENCY: "Choose a supported base currency.",
    BASE_CURRENCY_LOCKED:
      "Base currency cannot change after a balance is recorded.",
    PREFERENCES_REQUIRED: "Save your preferences first.",
    INVALID_ACCOUNT_MODE: "Choose whether to create or attach an account.",
    INVALID_ACCOUNT_NAME: "Enter an account name of 100 characters or fewer.",
    INVALID_INSTITUTION: "Institution must be 100 characters or fewer.",
    ACCOUNT_NOT_FOUND: "Savings account was not found.",
    ACCOUNT_NOT_SAVINGS: "Choose a savings account.",
    SAVINGS_ACCOUNT_REQUIRED: "Save a savings account first.",
    INVALID_BALANCE:
      "Enter a non-negative balance with at most two decimal places.",
    INVALID_RECORDED_AT: "Choose a valid date that is not in the future.",
    INITIAL_BALANCE_CONFLICT: "A different balance already exists for this date.",
    INITIAL_BALANCE_LOCKED: "Use Balance Snapshots to record later observations.",
    SETUP_SAVE_FAILED: "Setup could not be saved. Try again.",
  },
};

const CHINESE_COPY: SetupCopy = {
  shell: {
    brand: "储蓄教练",
    signOut: "退出登录",
    title: "设置你的储蓄起点",
    description: "完成三个简短步骤，约需两分钟。无需连接银行。",
    steps: {
      preferences: { label: "地区偏好", description: "语言、时区和基础货币" },
      savingsAccount: { label: "储蓄账户", description: "选择要持续积累的账户" },
      initialBalance: { label: "当前余额", description: "记录可回看的起始余额" },
    },
    region: "地区偏好",
    savingsAccount: "储蓄账户",
    startingBalance: "起始余额",
    privacy: "输入内容仅属于你的账户。储蓄教练只记录数据，不会转移资金。",
  },
  preferences: {
    checkpoint: "第 1 步，共 3 步",
    title: "地区偏好",
    description: "这些设置用于显示日期和金额。产品不会连接银行或转移资金。",
    language: "语言与地区",
    timeZone: "时区",
    timeZoneHelp: "用于判断余额快照属于哪个自然日。",
    baseCurrency: "基础货币",
    currencyLocked: "现有余额历史使用 CNY，因此基础货币已锁定。",
    currencyHelp: "所有余额使用一种基础货币。记录首个余额后将锁定。",
    localeLabels: {
      "en-US": "英语（美国）",
      "en-SG": "英语（新加坡）",
      "zh-CN": "简体中文",
    },
    currencyLabels: {
      AUD: "AUD — 澳大利亚元",
      CAD: "CAD — 加拿大元",
      CHF: "CHF — 瑞士法郎",
      CNY: "CNY — 人民币",
      EUR: "EUR — 欧元",
      GBP: "GBP — 英镑",
      HKD: "HKD — 港元",
      NZD: "NZD — 新西兰元",
      SGD: "SGD — 新加坡元",
      USD: "USD — 美元",
    },
    saving: "保存中…",
    save: "保存并继续",
  },
  account: {
    checkpoint: "第 2 步，共 3 步",
    title: "储蓄账户",
    description: "选择用于记录起始余额的储蓄账户。不要输入账号或凭据。",
    choice: "账户选择",
    useExisting: "使用现有账户",
    createNew: "创建新账户",
    savingsAccount: "储蓄账户",
    existingHelp: "现有余额历史不会改变。",
    accountName: "账户名称",
    accountPlaceholder: "例如：备用金",
    institution: "机构（可选）",
    institutionPlaceholder: "银行或服务机构",
    saving: "保存中…",
    save: "保存并继续",
  },
  balance: {
    checkpoint: "第 3 步，共 3 步",
    title: "当前余额",
    descriptionBeforeAccount: "记录",
    descriptionAt: "在",
    descriptionAfter: "中的余额。这是余额观察，不是资金转移。",
    currentBalance: "当前余额",
    amountHelpBeforeCurrency: "请输入以",
    amountHelpAfterCurrency: "计价的金额，最多保留两位小数。",
    balanceAsOf: "余额日期",
    todayBeforeTimeZone: "时区",
    todayBetween: "的今天是",
    saving: "保存中…",
    save: "保存并继续",
  },
  complete: {
    brand: "储蓄教练",
    signOut: "退出登录",
    title: "储蓄起点已保存",
    amountBefore: "你的起始余额为",
    amountBetween: "，账户为",
    amountAfter: "。",
    continue: "进入仪表盘",
    boundary: "这只是你记录的余额，不表示银行交易已经确认。",
  },
  loading: "正在加载初始设置…",
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_LOCALE: "请选择支持的语言。",
    INVALID_TIME_ZONE: "请选择有效时区。",
    INVALID_BASE_CURRENCY: "请选择支持的基础货币。",
    BASE_CURRENCY_LOCKED: "记录余额后不能修改基础货币。",
    PREFERENCES_REQUIRED: "请先保存地区偏好。",
    INVALID_ACCOUNT_MODE: "请选择使用现有账户或创建新账户。",
    INVALID_ACCOUNT_NAME: "请输入不超过 100 个字符的账户名称。",
    INVALID_INSTITUTION: "机构名称不能超过 100 个字符。",
    ACCOUNT_NOT_FOUND: "找不到该储蓄账户。",
    ACCOUNT_NOT_SAVINGS: "请选择储蓄账户。",
    SAVINGS_ACCOUNT_REQUIRED: "请先保存储蓄账户。",
    INVALID_BALANCE: "请输入非负余额，最多保留两位小数。",
    INVALID_RECORDED_AT: "请选择有效且不晚于今天的日期。",
    INITIAL_BALANCE_CONFLICT: "该日期已有不同的余额快照。",
    INITIAL_BALANCE_LOCKED: "请在余额记录中添加后续余额快照。",
    SETUP_SAVE_FAILED: "初始设置保存失败，请重试。",
  },
};

export function getSetupCopy(locale: string | null | undefined): SetupCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}
