"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { updateHomeAction } from "@/app/(app)/actions";
import { formatMoney } from "@/lib/format-money";
import {
  INITIAL_HOME_ACTION_STATE,
  type MonthlyExecutionHomeDto,
} from "@/lib/home/contracts";
import type { HomeCopy } from "@/lib/home/presentation";

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function formatMonth(yearMonth: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${yearMonth}-01T00:00:00.000Z`));
}

function formatActionDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function MonthlyExecutionHome({
  home,
  copy,
}: {
  home: MonthlyExecutionHomeDto;
  copy: HomeCopy;
}) {
  const [state, formAction, pending] = useActionState(
    updateHomeAction,
    INITIAL_HOME_ACTION_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  const progress =
    home.totalCount > 0
      ? Math.round((home.completedCount / home.totalCount) * 100)
      : 0;

  return (
    <div lang={home.locale} className="mx-auto w-full max-w-6xl pb-10 text-stone-950">
      <header className="border-b border-stone-200 pb-8 pt-2 sm:pb-10 sm:pt-4">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          {copy.page.title}
        </h1>
        <p className="mt-3 text-base text-stone-600 sm:text-lg">
          {fill(copy.page.subtitle, {
            month: formatMonth(home.currentYearMonth, home.locale),
          })}
        </p>
      </header>

      {state.status === "success" && state.behaviorActivatedNow ? (
        <section
          aria-live="polite"
          className="mt-8 rounded-xl bg-stone-950 p-6 text-white sm:p-8"
        >
          <div className="flex items-start gap-4">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400 text-emerald-950">
              <CheckIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                {copy.activation.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-300">
                {copy.activation.description}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {state.status === "error" ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {copy.errors[state.error.code]}
        </div>
      ) : null}

      {home.status === "needs_plan" ? (
        <section className="mt-8 grid gap-8 rounded-xl border border-stone-200 bg-white p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.035em]">
              {copy.needsPlan.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
              {copy.needsPlan.description}
            </p>
          </div>
          <Link
            href="/plan"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-700 px-5 text-base font-semibold text-white transition-colors hover:bg-orange-800"
          >
            {copy.needsPlan.action}
          </Link>
        </section>
      ) : null}

      {home.status === "needs_review" ? (
        <section className="mt-8 overflow-hidden rounded-xl bg-stone-950 text-white">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-300">
                {copy.needsReview.label}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
                {fill(copy.needsReview.title, {
                  reviewMonth: formatMonth(home.review.yearMonth, home.locale),
                  currentMonth: formatMonth(home.currentYearMonth, home.locale),
                })}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
                {copy.needsReview.description}
              </p>
              <p className="mt-5 text-sm text-stone-400">
                {fill(copy.needsReview.progress, {
                  completed: home.review.completedCount,
                  total: home.review.totalCount,
                })}
              </p>
            </div>
            <Link
              href={
                home.review.readyToReview
                  ? `/milestones/${home.review.yearMonth}/report`
                  : `/sop?month=${home.review.yearMonth}`
              }
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-600 px-5 text-base font-semibold text-white transition-colors hover:bg-orange-700"
            >
              {home.review.readyToReview
                ? fill(copy.needsReview.reviewAction, {
                    month: formatMonth(home.review.yearMonth, home.locale),
                  })
                : fill(copy.needsReview.finishAction, {
                    month: formatMonth(home.review.yearMonth, home.locale),
                  })}
            </Link>
          </div>
        </section>
      ) : null}

      {home.status === "needs_repair" ? (
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-amber-950">
            {copy.repair.title}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-amber-900">
            {copy.repair.description}
          </p>
          <Link
            href="/plan"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-amber-950 px-4 text-sm font-semibold text-white"
          >
            {copy.repair.action}
          </Link>
        </section>
      ) : null}

      {home.status === "ready" ? (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:gap-10">
          <section
            aria-label={copy.ready.ariaLabel}
            className="relative overflow-hidden rounded-xl bg-stone-950 p-6 text-stone-50 sm:p-8"
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-20 h-48 w-48 rounded-full border border-orange-400/20"
            />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-[-0.025em]">
                  {copy.ready.title}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    home.nextAction.dueStatus === "overdue"
                      ? "bg-red-300 text-red-950"
                      : "bg-orange-300 text-orange-950"
                  }`}
                >
                  {home.nextAction.dueStatus === "overdue"
                    ? fill(copy.ready.overdueSince, {
                        date: formatActionDate(home.nextAction.scheduledFor, home.locale),
                      })
                    : home.nextAction.dueStatus === "today"
                      ? copy.ready.dueToday
                      : fill(copy.ready.due, {
                          date: formatActionDate(home.nextAction.scheduledFor, home.locale),
                        })}
                </span>
              </div>
              <p className="mt-8 text-5xl font-semibold tabular-nums tracking-[-0.04em] text-white">
                {formatMoney(
                  Number(home.nextAction.amount),
                  home.locale,
                  home.baseCurrency
                )}
              </p>
              <h3 className="mt-4 text-xl font-medium text-white">
                {home.nextAction.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-300">
                {home.nextAction.sourceAccountName
                  ? fill(copy.ready.transferFrom, {
                      source: home.nextAction.sourceAccountName,
                      target: home.nextAction.targetAccountName,
                    })
                  : fill(copy.ready.transferTo, {
                      target: home.nextAction.targetAccountName,
                    })}
              </p>
              <p className="mt-6 border-t border-stone-800 pt-5 text-sm leading-6 text-stone-400">
                {copy.ready.description}
              </p>
              <form action={formAction} className="mt-7">
                <input type="hidden" name="action_id" value={home.nextAction.id} />
                <input type="hidden" name="operation" value="complete" />
                <button
                  type="submit"
                  disabled={pending}
                  aria-label={fill(copy.ready.confirmAria, { name: home.nextAction.name })}
                  className="min-h-12 w-full cursor-pointer rounded-xl bg-orange-600 px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(234,88,12,0.24)] transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? copy.ready.confirming : copy.ready.confirm}
                </button>
              </form>
            </div>
          </section>

          <HomeProgress
            home={home}
            copy={copy}
            progress={progress}
            formAction={formAction}
            pending={pending}
          />
        </div>
      ) : null}

      {home.status === "complete" ? (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:gap-10">
          <section className="rounded-xl bg-stone-950 p-6 text-white sm:p-8">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400 text-emerald-950">
              <CheckIcon className="h-5 w-5" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em]">
              {copy.complete.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
              {fill(copy.complete.description, {
                completed: home.completedCount,
                total: home.totalCount,
              })}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/plan"
                className="inline-flex min-h-11 items-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
              >
                {copy.complete.openPlan}
              </Link>
              <form action={formAction}>
                <input
                  type="hidden"
                  name="action_id"
                  value={home.lastCompletedAction.id}
                />
                <input type="hidden" name="operation" value="undo" />
                <button
                  type="submit"
                  disabled={pending}
                  aria-label={fill(copy.complete.undoAria, {
                    name: home.lastCompletedAction.name,
                  })}
                  className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-medium text-stone-400 transition-colors hover:bg-stone-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? copy.complete.undoing : copy.complete.undo}
                </button>
              </form>
            </div>
          </section>

          <HomeProgress
            home={home}
            copy={copy}
            progress={progress}
            formAction={formAction}
            pending={pending}
          />
        </div>
      ) : null}
    </div>
  );
}

function HomeProgress({
  home,
  copy,
  progress,
  formAction,
  pending,
}: {
  home: Extract<MonthlyExecutionHomeDto, { status: "ready" | "complete" }>;
  copy: HomeCopy;
  progress: number;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <aside className="space-y-8">
      <section
        aria-label={copy.progress.ariaLabel}
        className="border-y border-stone-200 py-6"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              {copy.progress.title}
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              {fill(copy.progress.count, {
                completed: home.completedCount,
                total: home.totalCount,
              })}
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-stone-950">
            {progress}%
          </p>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-orange-600 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {home.status === "ready" && home.lastCompletedAction ? (
          <form action={formAction} className="mt-4">
            <input
              type="hidden"
              name="action_id"
              value={home.lastCompletedAction.id}
            />
            <input type="hidden" name="operation" value="undo" />
            <button
              type="submit"
              disabled={pending}
              aria-label={fill(copy.progress.undoAria, {
                name: home.lastCompletedAction.name,
              })}
              className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copy.progress.undoLast}
            </button>
          </form>
        ) : null}
      </section>

      {home.planSummary ? (
        <section aria-label={copy.planSummary.ariaLabel} className="border-b border-stone-200 pb-6">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{copy.planSummary.title}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-500">{copy.planSummary.plannedThisMonth}</dt>
              <dd className="font-semibold tabular-nums text-stone-950">
                {formatMoney(
                  Number(home.planSummary.plannedTransfer),
                  home.locale,
                  home.baseCurrency
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-500">{copy.planSummary.targetBalance}</dt>
              <dd className="font-semibold tabular-nums text-stone-950">
                {formatMoney(
                  Number(home.planSummary.targetBalance),
                  home.locale,
                  home.baseCurrency
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-stone-500">
            {copy.planSummary.description}
          </p>
        </section>
      ) : null}
    </aside>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 10 3 3 7-7" />
    </svg>
  );
}
