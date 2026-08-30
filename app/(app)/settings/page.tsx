import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsTabs } from "./settings-tabs";
import type { Account, SopTemplate } from "@/lib/types/database";
import type { ReviewEmailReminderSettings } from "@/lib/reminders/contracts";

interface ReviewEmailReminderStateReceipt {
  enabled?: unknown;
  schedule_day?: unknown;
  schedule_local_time?: unknown;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const reminderFeatureEnabled =
    process.env.REVIEW_EMAIL_FEATURE_ENABLED === "true";

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
      .select("locale, base_currency, time_zone")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (setupRes.error || !setupRes.data?.time_zone) {
    throw new Error("Unable to load Settings");
  }

  const accounts = (accountsRes.data || []) as Account[];
  const templates = (templatesRes.data || []) as SopTemplate[];
  let reviewEmailReminder: ReviewEmailReminderSettings | null = null;
  if (reminderFeatureEnabled) {
    const reminderRes = await supabase.rpc("get_review_email_reminder_state");
    const reminderState =
      reminderRes.data as ReviewEmailReminderStateReceipt | null;
    if (reminderRes.error?.code === "42501") {
      reviewEmailReminder = null;
    } else if (
      reminderRes.error ||
      typeof reminderState?.enabled !== "boolean" ||
      reminderState.schedule_day !== 2 ||
      reminderState.schedule_local_time !== "09:00:00"
    ) {
      throw new Error("Unable to load Email reminder settings");
    } else {
      reviewEmailReminder = {
        status: reminderState.enabled ? "enabled" : "disabled",
        timeZone: setupRes.data.time_zone,
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">设置</h1>
      <p className="mt-1 text-sm text-gray-500">
        {reviewEmailReminder
          ? "管理账户、SOP 模板和邮件提醒"
          : "管理账户和 SOP 模板"}
      </p>

      <div className="mt-6">
        <SettingsTabs
          accounts={accounts}
          templates={templates}
          locale={setupRes.data?.locale || "en-US"}
          baseCurrency={setupRes.data?.base_currency || "USD"}
          reviewEmailReminder={reviewEmailReminder}
        />
      </div>
    </div>
  );
}
