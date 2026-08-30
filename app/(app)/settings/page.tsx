import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsTabs } from "./settings-tabs";
import type { Account, SopTemplate } from "@/lib/types/database";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accountsRes, templatesRes, setupRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("sort_order"),
    supabase
      .from("sop_templates")
      .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
      .eq("owner_id", user.id)
      .eq("is_plan_rule", false)
      .order("sort_order"),
    supabase
      .from("owner_setup")
      .select("locale, base_currency")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const accounts = (accountsRes.data || []) as Account[];
  const templates = (templatesRes.data || []) as SopTemplate[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">设置</h1>
      <p className="mt-1 text-sm text-gray-500">
        管理账户和 SOP 模板
      </p>

      <div className="mt-6">
        <SettingsTabs
          accounts={accounts}
          templates={templates}
          locale={setupRes.data?.locale || "en-US"}
          baseCurrency={setupRes.data?.base_currency || "USD"}
        />
      </div>
    </div>
  );
}
