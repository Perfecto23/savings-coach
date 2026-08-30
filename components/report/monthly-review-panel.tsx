"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { closeMonthlyReview } from "@/app/(app)/milestones/[yearMonth]/report/actions";
import { INITIAL_MONTHLY_REVIEW_ACTION_STATE } from "@/lib/monthly-review/contracts";

interface MonthlyReviewPanelProps {
  yearMonth: string;
  currentYearMonth: string;
  locale: string;
  reviewCompletedAt: string | null;
  isReviewWindow: boolean;
  completedCount: number;
  totalCount: number;
}

function formatMonth(yearMonth: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${yearMonth}-01T00:00:00.000Z`));
}

export function MonthlyReviewPanel({
  yearMonth,
  currentYearMonth,
  locale,
  reviewCompletedAt,
  isReviewWindow,
  completedCount,
  totalCount,
}: MonthlyReviewPanelProps) {
  const [state, formAction, pending] = useActionState(
    closeMonthlyReview,
    INITIAL_MONTHLY_REVIEW_ACTION_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const completedAt =
    state.status === "success" ? state.reviewCompletedAt : reviewCompletedAt;
  const ready = totalCount > 0 && completedCount === totalCount;

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  if (completedAt) {
    return (
      <section
        aria-label="Monthly Review status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Review complete
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          {formatMonth(yearMonth, locale)} is closed.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-900/80">
          Monthly execution is preserved. Balance Snapshots remain observations
          and can still be corrected.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white"
        >
          Open {formatMonth(currentYearMonth, locale)}
        </Link>
      </section>
    );
  }

  if (!isReviewWindow) return null;

  return (
    <section
      aria-label="Complete Monthly Review"
      className="rounded-xl bg-stone-950 p-5 text-white sm:p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-300">
        Monthly Review
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
        Close {formatMonth(yearMonth, locale)}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
        Closing preserves Monthly Action confirmations and prepares the current
        month. It does not confirm a bank balance or transfer.
      </p>
      <p className="mt-4 text-sm text-stone-400">
        {completedCount} of {totalCount} Monthly Actions confirmed
      </p>

      {state.status === "error" ? (
        <div className="mt-4">
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-lg border border-red-300/40 bg-red-950/50 px-3 py-2 text-sm text-red-100"
          >
            {state.error.message}
          </div>
          {state.error.code === "PLAN_NOT_READY" ? (
            <Link
              href="/plan"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-stone-700 px-4 text-sm font-semibold text-white"
            >
              Open Savings Plan
            </Link>
          ) : null}
        </div>
      ) : null}

      {ready ? (
        <form action={formAction} className="mt-5">
          <input type="hidden" name="year_month" value={yearMonth} />
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 cursor-pointer rounded-xl bg-orange-600 px-5 text-base font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Closing…"
              : `Close ${formatMonth(yearMonth, locale)}`}
          </button>
        </form>
      ) : (
        <Link
          href={`/sop?month=${yearMonth}`}
          className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-orange-600 px-5 text-base font-semibold text-white"
        >
          Finish Monthly Actions
        </Link>
      )}
    </section>
  );
}
