"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSetupPreferences } from "@/app/setup/actions";
import { FieldError } from "@/components/setup/field-error";
import {
  INITIAL_SETUP_FORM_STATE,
  SUPPORTED_BASE_CURRENCIES,
  SUPPORTED_SETUP_LOCALES,
} from "@/lib/setup/contracts";

const LOCALE_LABELS: Record<string, string> = {
  "en-US": "English (United States)",
  "en-SG": "English (Singapore)",
  "zh-CN": "简体中文",
};

const TIME_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Australia/Sydney",
] as const;

const CURRENCY_LABELS: Record<string, string> = {
  AUD: "AUD — Australian dollar",
  CAD: "CAD — Canadian dollar",
  CHF: "CHF — Swiss franc",
  CNY: "CNY — Chinese yuan",
  EUR: "EUR — Euro",
  GBP: "GBP — British pound",
  HKD: "HKD — Hong Kong dollar",
  NZD: "NZD — New Zealand dollar",
  SGD: "SGD — Singapore dollar",
  USD: "USD — US dollar",
};

interface PreferencesStepProps {
  legacyCurrencyLocked: boolean;
}

export function PreferencesStep({ legacyCurrencyLocked }: PreferencesStepProps) {
  const [state, formAction, pending] = useActionState(
    saveSetupPreferences,
    INITIAL_SETUP_FORM_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const fieldError = state.status === "error" ? state.error : null;

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <div>
      <p className="text-sm font-medium text-orange-700">Checkpoint 1 of 3</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-stone-950">
        Your region
      </h2>
      <p className="mt-3 max-w-lg text-base leading-7 text-stone-600">
        These settings keep dates and money readable. They do not connect a
        bank or move funds.
      </p>

      <form action={formAction} className="mt-8 space-y-6">
        {state.status === "error" ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {state.error.message}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="setup-locale"
            className="block text-sm font-medium text-stone-800"
          >
            Language and locale
          </label>
          <select
            id="setup-locale"
            name="locale"
            defaultValue="en-US"
            aria-invalid={fieldError?.field === "locale"}
            aria-describedby={
              fieldError?.field === "locale" ? "setup-locale-error" : undefined
            }
            className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {SUPPORTED_SETUP_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {LOCALE_LABELS[locale]}
              </option>
            ))}
          </select>
          <FieldError
            id="setup-locale-error"
            field="locale"
            error={fieldError}
          />
        </div>

        <div>
          <label
            htmlFor="setup-time-zone"
            className="block text-sm font-medium text-stone-800"
          >
            Time zone
          </label>
          <select
            id="setup-time-zone"
            name="time_zone"
            defaultValue="Asia/Singapore"
            aria-invalid={fieldError?.field === "time_zone"}
            aria-describedby={
              fieldError?.field === "time_zone"
                ? "setup-time-zone-help setup-time-zone-error"
                : "setup-time-zone-help"
            }
            className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {TIME_ZONES.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {timeZone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <p id="setup-time-zone-help" className="mt-2 text-sm leading-6 text-stone-500">
            Used to decide which calendar day a balance belongs to.
          </p>
          <FieldError
            id="setup-time-zone-error"
            field="time_zone"
            error={fieldError}
          />
        </div>

        <div>
          <label
            htmlFor="setup-base-currency"
            className="block text-sm font-medium text-stone-800"
          >
            Base currency
          </label>
          {legacyCurrencyLocked ? (
            <input type="hidden" name="base_currency" value="CNY" />
          ) : null}
          <select
            id="setup-base-currency"
            name={legacyCurrencyLocked ? undefined : "base_currency"}
            defaultValue={legacyCurrencyLocked ? "CNY" : "USD"}
            disabled={legacyCurrencyLocked}
            aria-invalid={fieldError?.field === "base_currency"}
            aria-describedby={
              fieldError?.field === "base_currency"
                ? "base-currency-help setup-base-currency-error"
                : "base-currency-help"
            }
            className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
          >
            {SUPPORTED_BASE_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </option>
            ))}
          </select>
          <p id="base-currency-help" className="mt-2 text-sm leading-6 text-stone-500">
            {legacyCurrencyLocked
              ? "Your existing balance history uses CNY, so this value is locked."
              : "All balances in this workspace use one currency. It locks after your first balance."}
          </p>
          <FieldError
            id="setup-base-currency-error"
            field="base_currency"
            error={fieldError}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-orange-700 px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(194,65,12,0.24)] transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
