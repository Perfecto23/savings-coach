import { isChineseLocale } from "@/lib/i18n/locale";

export type IncomeActionErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_MONTHLY_GROSS"
  | "INVALID_HOUSING_RATE"
  | "INVALID_HOUSING_BASE"
  | "INVALID_SOCIAL_INSURANCE"
  | "INVALID_SPECIAL_DEDUCTIONS"
  | "SALARY_NOT_FOUND"
  | "INVALID_BONUS_TYPE"
  | "INVALID_AMOUNT"
  | "INVALID_DATE"
  | "BONUS_NOT_FOUND"
  | "SAVE_FAILED";

export interface IncomeCopy {
  page: { title: string; description: string };
  salary: {
    title: string;
    description: string;
    monthlyGross: string;
    socialInsurance: string;
    socialPlaceholder: string;
    housingRate: string;
    housingBase: string;
    housingBasePlaceholder: string;
    specialDeductions: string;
    specialPlaceholder: string;
    effectiveFrom: string;
    estimatedNet: string;
    rangeDirection: string;
    saving: string;
    save: string;
  };
  bonusForm: {
    type: string;
    signingBonus: string;
    yearEndBonus: string;
    other: string;
    name: string;
    namePlaceholder: string;
    grossAmount: string;
    expectedDate: string;
    targetAccount: string;
    unspecified: string;
    note: string;
    cancel: string;
    saving: string;
    update: string;
    add: string;
  };
  bonuses: {
    title: string;
    description: string;
    add: string;
    empty: string;
    type: string;
    name: string;
    amount: string;
    date: string;
    targetAccount: string;
    status: string;
    actions: string;
    actual: string;
    received: string;
    actualAmount: string;
    confirm: string;
    markReceived: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
  };
  forecast: {
    title: string;
    description: string;
    month: string;
    gross: string;
    socialInsurance: string;
    housingFund: string;
    tax: string;
    net: string;
    housingCumulative: string;
    bonus: string;
    total: string;
    monthSuffix: string;
  };
  errors: Record<IncomeActionErrorCode, string>;
}

const ENGLISH_COPY: IncomeCopy = {
  page: {
    title: "Income",
    description: "Configure salary assumptions, view monthly estimates, and manage Bonus Events.",
  },
  salary: {
    title: "Salary configuration",
    description: "Estimate monthly take-home income with China’s cumulative withholding method.",
    monthlyGross: "Monthly gross",
    socialInsurance: "Monthly employee social insurance",
    socialPlaceholder: "Pension, medical, and unemployment",
    housingRate: "Housing fund rate (%)",
    housingBase: "Housing fund base",
    housingBasePlaceholder: "Defaults to monthly gross",
    specialDeductions: "Monthly special deductions",
    specialPlaceholder: "For example rent or education",
    effectiveFrom: "Effective from",
    estimatedNet: "Estimated monthly take-home:",
    rangeDirection: "(start → end of year)",
    saving: "Saving…",
    save: "Save configuration",
  },
  bonusForm: {
    type: "Type",
    signingBonus: "Signing bonus",
    yearEndBonus: "Year-end bonus",
    other: "Other",
    name: "Name",
    namePlaceholder: "For example, June signing bonus",
    grossAmount: "Gross amount",
    expectedDate: "Expected date",
    targetAccount: "Planned target account",
    unspecified: "Not specified",
    note: "Note",
    cancel: "Cancel",
    saving: "Saving…",
    update: "Update",
    add: "Add",
  },
  bonuses: {
    title: "Bonus Events",
    description: "One-time income such as signing and year-end bonuses.",
    add: "+ Add",
    empty: "No Bonus Events yet.",
    type: "Type",
    name: "Name",
    amount: "Amount",
    date: "Date",
    targetAccount: "Target account",
    status: "Status",
    actions: "Actions",
    actual: "Actual",
    received: "Received",
    actualAmount: "Actual amount received",
    confirm: "Confirm",
    markReceived: "Mark received",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this Bonus Event?",
  },
  forecast: {
    title: "Monthly take-home estimate",
    description: "China cumulative withholding usually produces lower tax early in the year and higher tax later.",
    month: "Month",
    gross: "Gross",
    socialInsurance: "Social insurance",
    housingFund: "Housing fund",
    tax: "Tax",
    net: "Take-home",
    housingCumulative: "Housing fund cumulative",
    bonus: "Bonus",
    total: "Total",
    monthSuffix: "",
  },
  errors: {
    UNAUTHENTICATED: "Please sign in again.",
    INVALID_MONTHLY_GROSS: "Enter a valid monthly gross amount.",
    INVALID_HOUSING_RATE: "Enter a valid housing fund rate.",
    INVALID_HOUSING_BASE: "Enter a valid housing fund base.",
    INVALID_SOCIAL_INSURANCE: "Enter a valid social insurance amount.",
    INVALID_SPECIAL_DEDUCTIONS: "Enter a valid special deduction amount.",
    SALARY_NOT_FOUND: "Salary configuration was not found.",
    INVALID_BONUS_TYPE: "Choose a valid Bonus Event type.",
    INVALID_AMOUNT: "Enter a valid positive amount.",
    INVALID_DATE: "Choose a valid date.",
    BONUS_NOT_FOUND: "Bonus Event was not found.",
    SAVE_FAILED: "Changes could not be saved. Try again.",
  },
};

const CHINESE_COPY: IncomeCopy = {
  page: { title: "收入管理", description: "配置薪资假设、查看月度预测并管理奖金事件。" },
  salary: {
    title: "薪资配置",
    description: "按中国累计预扣法估算月度到手收入。",
    monthlyGross: "税前月薪",
    socialInsurance: "社保个人月缴",
    socialPlaceholder: "养老、医疗和失业",
    housingRate: "公积金比例（%）",
    housingBase: "公积金基数",
    housingBasePlaceholder: "默认等于税前月薪",
    specialDeductions: "专项附加扣除月额",
    specialPlaceholder: "例如租房或教育",
    effectiveFrom: "生效日期",
    estimatedNet: "预估每月到手：",
    rangeDirection: "（年初 → 年末）",
    saving: "保存中…",
    save: "保存配置",
  },
  bonusForm: {
    type: "类型",
    signingBonus: "签字费",
    yearEndBonus: "年终奖",
    other: "其他",
    name: "名称",
    namePlaceholder: "例如：6 月签字费",
    grossAmount: "税前金额",
    expectedDate: "预计日期",
    targetAccount: "计划存入账户",
    unspecified: "未指定",
    note: "备注",
    cancel: "取消",
    saving: "保存中…",
    update: "更新",
    add: "添加",
  },
  bonuses: {
    title: "奖金事件",
    description: "签字费、年终奖等一次性收入。",
    add: "+ 添加",
    empty: "暂无奖金事件。",
    type: "类型",
    name: "名称",
    amount: "金额",
    date: "日期",
    targetAccount: "存入账户",
    status: "状态",
    actions: "操作",
    actual: "实际",
    received: "已到账",
    actualAmount: "实际到账金额",
    confirm: "确认",
    markReceived: "标记到账",
    edit: "编辑",
    delete: "删除",
    deleteConfirm: "确定删除此奖金事件？",
  },
  forecast: {
    title: "月度到手预测",
    description: "按中国累计预扣法估算，年初个税通常较低，年末较高。",
    month: "月份",
    gross: "税前",
    socialInsurance: "社保",
    housingFund: "公积金",
    tax: "个税",
    net: "到手",
    housingCumulative: "公积金累计",
    bonus: "奖金",
    total: "合计",
    monthSuffix: "月",
  },
  errors: {
    UNAUTHENTICATED: "请重新登录。",
    INVALID_MONTHLY_GROSS: "请输入有效的税前月薪。",
    INVALID_HOUSING_RATE: "请输入有效的公积金比例。",
    INVALID_HOUSING_BASE: "请输入有效的公积金基数。",
    INVALID_SOCIAL_INSURANCE: "请输入有效的社保金额。",
    INVALID_SPECIAL_DEDUCTIONS: "请输入有效的专项扣除金额。",
    SALARY_NOT_FOUND: "找不到薪资配置。",
    INVALID_BONUS_TYPE: "请选择有效的奖金事件类型。",
    INVALID_AMOUNT: "请输入有效的正数金额。",
    INVALID_DATE: "请选择有效日期。",
    BONUS_NOT_FOUND: "找不到该奖金事件。",
    SAVE_FAILED: "保存失败，请重试。",
  },
};

export function getIncomeCopy(locale: string | null | undefined): IncomeCopy {
  return isChineseLocale(locale) ? CHINESE_COPY : ENGLISH_COPY;
}

export function getIncomeErrorMessage(error: string, copy: IncomeCopy): string {
  return copy.errors[error as IncomeActionErrorCode] ?? copy.errors.SAVE_FAILED;
}
