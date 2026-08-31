"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { Account, SopTemplate } from "@/lib/types/database";
import { AccountManager } from "@/components/settings/account-manager";
import { SopTemplateEditor } from "@/components/settings/sop-template-editor";
import { ReviewEmailReminderSettings } from "@/components/settings/review-email-reminder-settings";
import type { ReviewEmailReminderSettings as ReviewEmailReminderSettingsDto } from "@/lib/reminders/contracts";
import type { SettingsCopy } from "@/lib/settings/presentation";

type TabId = "accounts" | "sop" | "review-email-reminders";

interface SettingsTabsProps {
  accounts: Account[];
  templates: SopTemplate[];
  locale: string;
  baseCurrency: string;
  reviewEmailReminder: ReviewEmailReminderSettingsDto | null;
  copy: SettingsCopy;
}

export function SettingsTabs({
  accounts,
  templates,
  locale,
  baseCurrency,
  reviewEmailReminder,
  copy,
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("accounts");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const allTabs = [
    { id: "accounts" as const, label: copy.tabs.accounts },
    { id: "sop" as const, label: copy.tabs.sop },
    {
      id: "review-email-reminders" as const,
      label: copy.tabs.email,
      ariaLabel: copy.tabs.emailAria,
    },
  ];
  const tabs = reviewEmailReminder ? allTabs : allTabs.slice(0, 2);

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
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1" role="tablist" aria-label={copy.tabs.sectionsAria}>
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
          <AccountManager initialAccounts={accounts} copy={copy} />
        )}
        {activeTab === "sop" && (
          <SopTemplateEditor
            initialTemplates={templates}
            accounts={accounts}
            locale={locale}
            baseCurrency={baseCurrency}
            copy={copy}
          />
        )}
        {activeTab === "review-email-reminders" && reviewEmailReminder && (
          <ReviewEmailReminderSettings
            reminder={reviewEmailReminder}
            copy={copy.reminder}
          />
        )}
      </div>
    </div>
  );
}
