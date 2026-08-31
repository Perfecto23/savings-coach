"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clearRequestLocale,
  getRequestLocale,
  setRequestLocale,
} from "@/lib/i18n/request-locale";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: "AUTH_FAILED" as const };
  }

  const { data: setup } = await supabase
    .from("owner_setup")
    .select("locale")
    .maybeSingle();
  await setRequestLocale(setup?.locale ?? (await getRequestLocale()));

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearRequestLocale();
  revalidatePath("/", "layout");
  redirect("/login");
}
