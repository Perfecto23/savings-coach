import { createClient } from "@/lib/supabase/server";
import { SettingsTabs } from "./settings-tabs";
import type { Account, SopTemplate, AiConfig } from "@/lib/types/database";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [accountsRes, templatesRes, aiConfigsRes] = await Promise.all([
    supabase.from("accounts").select("*").order("sort_order"),
    supabase.from("sop_templates").select("*").order("sort_order"),
    supabase.from("ai_configs").select("*").order("created_at"),
  ]);

  const accounts = (accountsRes.data || []) as Account[];
  const templates = (templatesRes.data || []) as SopTemplate[];
  const aiConfigs = (aiConfigsRes.data || []) as AiConfig[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">设置</h1>
      <p className="mt-1 text-sm text-gray-500">
        管理账户、SOP 模板和 AI 模型配置
      </p>

      <div className="mt-6">
        <SettingsTabs
          accounts={accounts}
          templates={templates}
          aiConfigs={aiConfigs}
        />
      </div>
    </div>
  );
}
