"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { Account, SopTemplate } from "@/lib/types/database";
import { AccountManager } from "@/components/settings/account-manager";
import { SopTemplateEditor } from "@/components/settings/sop-template-editor";
import { ReviewEmailReminderSettings } from "@/components/settings/review-email-reminder-settings";
import type { ReviewEmailReminderSettings as ReviewEmailReminderSettingsDto } from "@/lib/reminders/contracts";

const TABS = [
  { id: "accounts", label: "账户管理" },
  { id: "sop", label: "SOP 模板" },
  { id: "review-email-reminders", label: "Email", ariaLabel: "Email reminders" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SettingsTabsProps {
  accounts: Account[];
  templates: SopTemplate[];
  locale: string;
  baseCurrency: string;
  reviewEmailReminder: ReviewEmailReminderSettingsDto | null;
}

export function SettingsTabs({
  accounts,
  templates,
  locale,
  baseCurrency,
  reviewEmailReminder,
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("accounts");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = reviewEmailReminder ? TABS : TABS.slice(0, 2);

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (![
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
            tabs.length;
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1" role="tablist" aria-label="Settings sections">
        {tabs.map((tab, index) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            id={`${tab.id}-tab`}
            aria-controls={`${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            aria-label={"ariaLabel" in tab ? tab.ariaLabel : undefined}
            tabIndex={activeTab === tab.id ? 0 : -1}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`min-h-12 flex-1 cursor-pointer rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-4 ${
              activeTab === tab.id
                ? "bg-white text-stone-950 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`${activeTab}-panel`}
        aria-labelledby={`${activeTab}-tab`}
        className="mt-6"
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "accounts" && (
          <AccountManager initialAccounts={accounts} />
        )}
        {activeTab === "sop" && (
          <SopTemplateEditor
            initialTemplates={templates}
            accounts={accounts}
            locale={locale}
            baseCurrency={baseCurrency}
          />
        )}
        {activeTab === "review-email-reminders" && reviewEmailReminder && (
          <ReviewEmailReminderSettings reminder={reviewEmailReminder} />
        )}
      </div>
    </div>
  );
}
