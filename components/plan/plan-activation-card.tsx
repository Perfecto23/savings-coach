"use client";

import { useActionState, useEffect, useRef } from "react";
import { activateSavingsPlan } from "@/app/(app)/plan/actions";
import { formatMoney } from "@/lib/format-money";
import {
  INITIAL_PLAN_FORM_STATE,
  type MonthlyActionDto,
  type PlanAccountDto,
} from "@/lib/plan/contracts";
import type { PlanCopy } from "@/lib/plan/presentation";

function formatDueDate(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function PlanActivationCard({
  isActivated,
  activeRuleCount,
  monthlyPlannedAmount,
  locale,
  baseCurrency,
  targetAccount,
  nextAction,
  copy,
}: {
  isActivated: boolean;
  activeRuleCount: number;
  monthlyPlannedAmount: string;
  locale: string;
  baseCurrency: string;
  targetAccount: PlanAccountDto;
  nextAction: MonthlyActionDto | null;
  copy: PlanCopy;
}) {
  const [state, formAction, pending] = useActionState(
    activateSavingsPlan,
    INITIAL_PLAN_FORM_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  if (isActivated) {
    return (
      <section className="relative overflow-hidden rounded-xl bg-stone-950 p-6 text-stone-50 sm:p-8">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-48 w-48 rounded-full border border-orange-400/20" />
        <div aria-hidden="true" className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-orange-500/10" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400 text-emerald-950">
              <CheckIcon className="h-4 w-4" />
            </span>
            <p className="text-lg font-semibold tracking-[-0.02em]">
              {copy.activation.activeTitle}
            </p>
          </div>
          <p className="mt-6 text-xl font-medium leading-8 tracking-[-0.025em] text-white sm:text-2xl">
            {copy.activation.activeSummary
              .replace("{amount}", formatMoney(Number(monthlyPlannedAmount), locale, baseCurrency))
              .replace("{account}", targetAccount.name)}
          </p>
          <p className="mt-4 text-sm leading-6 text-stone-300">
            {nextAction
              ? copy.activation.nextAction.replace("{date}", formatDueDate(nextAction.scheduledFor, locale))
              : copy.activation.currentActionsComplete}
          </p>
          <p className="mt-6 border-t border-stone-800 pt-5 text-xs leading-5 text-stone-500">
            {copy.activation.safetyNote}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-stone-950">
        {copy.activation.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        {copy.activation.description}
      </p>

      {state.status === "error" ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {copy.errorMessages[state.error.code]}
        </div>
      ) : null}

      <form action={formAction} className="mt-6">
        <button
          type="submit"
          disabled={pending || activeRuleCount === 0}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-orange-700 px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(194,65,12,0.24)] transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? copy.activation.submitting : copy.activation.submit}
        </button>
      </form>

      {activeRuleCount === 0 ? (
        <p className="mt-3 text-sm leading-6 text-stone-500">
          {copy.activation.disabledHelp}
        </p>
      ) : null}
    </section>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden="true">
      <path d="m5 10 3 3 7-7" />
    </svg>
  );
}
