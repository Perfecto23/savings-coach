"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/locale";

export function DocumentLocale({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [locale]);

  return null;
}
