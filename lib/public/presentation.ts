import { APP_LOCALE, type AppLocale } from "@/lib/product-locale";

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
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
  };
}

const COPY: PublicCopy = {
  locale: APP_LOCALE,
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
    emailRequired: "请输入邮箱。",
    emailInvalid: "请输入有效的邮箱地址。",
    passwordRequired: "请输入密码。",
  },
};

export function getPublicCopy(): PublicCopy {
  return COPY;
}
