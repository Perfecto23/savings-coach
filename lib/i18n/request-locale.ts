import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, normalizeLocale, type AppLocale } from "./locale";

const getOwnerLocale = cache(async (): Promise<AppLocale | null> => {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name));
  if (!hasAuthCookie) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("owner_setup")
      .select("locale")
      .eq("owner_id", user.id)
      .maybeSingle();
    return data?.locale ? normalizeLocale(data.locale) : null;
  } catch {
    return null;
  }
});

export const getRequestLocale = cache(async (): Promise<AppLocale> => {
  const ownerLocale = await getOwnerLocale();
  if (ownerLocale) return ownerLocale;

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale) return normalizeLocale(cookieLocale);

  const acceptLanguage = (await headers()).get("accept-language")?.toLowerCase();
  return acceptLanguage?.includes("zh") ? "zh-CN" : "en-US";
});

export async function setRequestLocale(locale: string) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, normalizeLocale(locale), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearRequestLocale() {
  (await cookies()).delete(LOCALE_COOKIE);
}
