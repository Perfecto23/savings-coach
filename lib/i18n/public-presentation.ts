import { isChineseLocale, normalizeLocale, type AppLocale } from "./locale";

export interface PublicCopy {
  locale: AppLocale;
  metadata: {
    title: string;
    template: string;
    description: string;
    openGraphDescription: string;
    openGraphLocale: string;
  };
  login: {
    brand: string;
    description: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    error: string;
  };
}

const ENGLISH_COPY: Omit<PublicCopy, "locale"> = {
  metadata: {
    title: "Savings Coach — Your personal savings companion",
    template: "%s | Savings Coach",
    description:
      "A personal savings workspace for monthly execution, Balance Snapshots, and review.",
    openGraphDescription: "Monthly savings execution, Balance Snapshots, and progress review.",
    openGraphLocale: "en_US",
  },
  login: {
    brand: "Savings Coach",
    description: "Log in to continue your savings process.",
    email: "Email",
    password: "Password",
    submit: "Log in",
    submitting: "Logging in…",
    error: "Email or password is incorrect. Try again.",
  },
};

const CHINESE_COPY: Omit<PublicCopy, "locale"> = {
  metadata: {
    title: "储蓄教练 — 你的个人储蓄伙伴",
    template: "%s | 储蓄教练",
    description: "帮助你执行月度储蓄流程、记录余额快照并复盘进展的个人储蓄工具。",
    openGraphDescription: "月度储蓄执行、余额快照与进展复盘。",
    openGraphLocale: "zh_CN",
  },
  login: {
    brand: "储蓄教练",
    description: "登录后继续你的储蓄流程。",
    email: "邮箱",
    password: "密码",
    submit: "登录",
    submitting: "登录中…",
    error: "邮箱或密码错误，请重试。",
  },
};

export function getPublicCopy(locale: string | null | undefined): PublicCopy {
  const normalized = normalizeLocale(locale);
  const copy = isChineseLocale(normalized) ? CHINESE_COPY : ENGLISH_COPY;
  return { ...copy, locale: normalized };
}
