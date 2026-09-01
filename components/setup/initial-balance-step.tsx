"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSetupInitialBalance } from "@/app/setup/actions";
import { FieldError } from "@/components/setup/field-error";
import { formatMoney } from "@/lib/format-money";
import {
  INITIAL_SETUP_FORM_STATE,
  type SetupPreferencesDto,
  type SetupSavingsAccountDto,
} from "@/lib/setup/contracts";
import type { SetupFormErrorCode } from "@/lib/setup/contracts";
import type { SetupCopy } from "@/lib/setup/presentation";

interface InitialBalanceStepProps {
  preferences: SetupPreferencesDto;
  account: SetupSavingsAccountDto;
  copy: SetupCopy["balance"];
  errorCopy: Record<SetupFormErrorCode, string>;
}

function getTodayInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function InitialBalanceStep({
  preferences,
  account,
  copy,
  errorCopy,
}: InitialBalanceStepProps) {
  const [state, formAction, pending] = useActionState(
    saveSetupInitialBalance,
    INITIAL_SETUP_FORM_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const fieldError = state.status === "error" ? state.error : null;
  const today = getTodayInTimeZone(preferences.timeZone);

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <div>
      <p className="text-sm font-medium text-orange-700">{copy.checkpoint}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-stone-950">
        {copy.title}
      </h2>
      <p className="mt-3 max-w-lg text-base leading-7 text-stone-600">
        {copy.descriptionBeforeAccount}{" "}
        <strong className="font-semibold text-stone-900">{account.name}</strong>
        {account.institution
          ? ` ${copy.descriptionAt} ${account.institution}`
          : ""}
        {copy.descriptionAfter}
      </p>

      <form action={formAction} className="mt-8 space-y-6" noValidate>
        {state.status === "error" ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorCopy[state.error.code]}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="setup-balance"
            className="block text-sm font-medium text-stone-800"
          >
            {copy.currentBalance}
          </label>
          <input
            id="setup-balance"
            name="balance"
            type="text"
            inputMode="decimal"
            required
            pattern="(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?"
            placeholder={formatMoney(
              0,
              preferences.locale,
              preferences.baseCurrency
            )}
            aria-invalid={fieldError?.field === "balance"}
            aria-describedby={
              fieldError?.field === "balance"
                ? "setup-balance-help setup-balance-error"
                : "setup-balance-help"
            }
            className="mt-2 min-h-14 w-full rounded-xl border border-stone-300 bg-white px-4 text-2xl font-semibold tabular-nums tracking-[-0.02em] shadow-sm placeholder:text-stone-300 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <p id="setup-balance-help" className="mt-2 text-sm leading-6 text-stone-500">
            {copy.amountHelpBeforeCurrency} {preferences.baseCurrency}.{" "}
            {copy.amountHelpAfterCurrency}
          </p>
          <FieldError
            id="setup-balance-error"
            field="balance"
            error={fieldError}
            message={fieldError ? errorCopy[fieldError.code] : ""}
          />
        </div>

        <div>
          <label
            htmlFor="setup-recorded-at"
            className="block text-sm font-medium text-stone-800"
          >
            {copy.balanceAsOf}
          </label>
          <input
            id="setup-recorded-at"
            name="recorded_at"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            required
            defaultValue={today}
            aria-invalid={fieldError?.field === "recorded_at"}
            aria-describedby={
              fieldError?.field === "recorded_at"
                ? "setup-recorded-at-help setup-recorded-at-error"
                : "setup-recorded-at-help"
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <p id="setup-recorded-at-help" className="mt-2 text-sm leading-6 text-stone-500">
            {copy.todayBeforeTimeZone} {preferences.timeZone} {copy.todayBetween}{" "}
            {today}.
          </p>
          <FieldError
            id="setup-recorded-at-error"
            field="recorded_at"
            error={fieldError}
            message={fieldError ? errorCopy[fieldError.code] : ""}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-orange-700 px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(194,65,12,0.24)] transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? copy.saving : copy.save}
        </button>
      </form>
    </div>
  );
}
