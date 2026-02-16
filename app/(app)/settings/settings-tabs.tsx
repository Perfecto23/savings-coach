"use client";

import { useState } from "react";
import type { Account, SopTemplate, AiConfig } from "@/lib/types/database";
import { AccountManager } from "@/components/settings/account-manager";
import { SopTemplateEditor } from "@/components/settings/sop-template-editor";
import { AiConfigManager } from "@/components/settings/ai-config-form";

const TABS = [
  { id: "accounts", label: "账户管理" },
  { id: "sop", label: "SOP 模板" },
  { id: "ai", label: "AI 模型" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SettingsTabsProps {
  accounts: Account[];
  templates: SopTemplate[];
  aiConfigs: AiConfig[];
}

export function SettingsTabs({ accounts, templates, aiConfigs }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("accounts");

  return (
    <div>
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 cursor-pointer rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-4 ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {activeTab === "accounts" && (
          <AccountManager initialAccounts={accounts} />
        )}
        {activeTab === "sop" && (
          <SopTemplateEditor
            initialTemplates={templates}
            accounts={accounts}
          />
        )}
        {activeTab === "ai" && (
          <AiConfigManager initialConfigs={aiConfigs} />
        )}
      </div>
    </div>
  );
}
