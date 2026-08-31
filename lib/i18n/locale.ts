export const APP_LOCALES = ["en-US", "en-SG", "zh-CN"] as const;
export const LOCALE_COOKIE = "savings-coach-locale";

export type AppLocale = (typeof APP_LOCALES)[number];
export type AppLanguage = "en" | "zh";

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (locale === "zh-CN") return "zh-CN";
  if (locale === "en-SG") return "en-SG";
  return "en-US";
}

export function getLanguage(locale: string | null | undefined): AppLanguage {
  return normalizeLocale(locale) === "zh-CN" ? "zh" : "en";
}

export function isChineseLocale(locale: string | null | undefined): boolean {
  return getLanguage(locale) === "zh";
}
