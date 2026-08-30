"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMilestone } from "@/app/(app)/income/actions";
import { formatMoney } from "@/lib/format-money";
import type { BonusEvent, MonthlyMilestone } from "@/lib/types/database";

interface MilestoneTableProps {
  milestones: MonthlyMilestone[];
  bonusEvents: BonusEvent[];
  locale: string;
  baseCurrency: string;
  currentYearMonth: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Execution pending", className: "bg-stone-100 text-stone-600" },
  on_track: { label: "Execution complete", className: "bg-emerald-100 text-emerald-800" },
  exceeded: { label: "Execution complete", className: "bg-emerald-100 text-emerald-800" },
  missed: { label: "Execution incomplete", className: "bg-amber-100 text-amber-900" },
};

export function MilestoneTable({
  milestones: initialMilestones,
  bonusEvents,
  locale,
  baseCurrency,
  currentYearMonth,
}: MilestoneTableProps) {
  const [milestones, setMilestones] = useState(initialMilestones);
  const router = useRouter();
  const currentMonth = currentYearMonth;

  async function handleDelete(yearMonth: string) {
    if (!window.confirm(`Delete the legacy Monthly Milestone for ${yearMonth}?`)) return;
    const result = await deleteMilestone(yearMonth);
    if (result.success) {
      setMilestones((previous) =>
        previous.filter((milestone) => milestone.year_month !== yearMonth)
      );
      router.refresh();
    }
  }

  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        No Progress data yet. Activate a Savings Plan to create a Plan Path.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-800">
        Execution status only reflects Monthly Action confirmations. Net value
        change comes from Balance Snapshots and can include transfers,
        withdrawals, or market movement.
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/70">
                <Header align="left">Month</Header>
                <Header>Planned transfer</Header>
                <Header>Target balance</Header>
                <Header>Net value change</Header>
                <Header>Balance Snapshot total</Header>
                <Header align="center">Execution status</Header>
                <Header align="left">Bonus events</Header>
                <Header align="center">Report</Header>
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => {
                const isCurrent = milestone.year_month === currentMonth;
                const isFuture = milestone.year_month > currentMonth;
                const bonuses = bonusEvents.filter(
                  (event) => event.expected_date.slice(0, 7) === milestone.year_month
                );
                const badge = STATUS_BADGES[milestone.status] ?? STATUS_BADGES.pending;

                return (
                  <tr
                    key={milestone.id}
                    className={`border-b border-stone-50 last:border-0 ${
                      isCurrent ? "bg-orange-50/60" : isFuture ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className={isCurrent ? "font-medium text-orange-800" : "font-medium text-stone-950"}>
                        {milestone.year_month}
                      </span>
                      {isCurrent ? (
                        <span className="ml-1.5 text-xs text-orange-700">Current</span>
                      ) : null}
                    </td>
                    <MoneyCell value={milestone.planned_savings} locale={locale} currency={baseCurrency} />
                    <MoneyCell value={milestone.planned_total_savings} locale={locale} currency={baseCurrency} muted />
                    <MoneyCell value={milestone.actual_savings} locale={locale} currency={baseCurrency} />
                    <MoneyCell value={milestone.actual_total_savings} locale={locale} currency={baseCurrency} muted />
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {bonuses.length === 0 ? (
                        <span className="text-stone-400">—</span>
                      ) : (
                        bonuses.map((bonus) => (
                          <span key={bonus.id} className="mr-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            {bonus.label}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/milestones/${milestone.year_month}/report`}
                          aria-label="Open monthly report"
                          className="text-xs font-medium text-orange-700 hover:text-orange-800 hover:underline"
                        >
                          Open
                        </Link>
                        {!milestone.is_plan_path &&
                        milestone.year_month <= currentMonth &&
                        milestone.actual_savings == null ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(milestone.year_month)}
                            className="cursor-pointer text-xs text-stone-400 transition-colors hover:text-red-600"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Header({
  children,
  align = "right",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  const alignment = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  }[align];
  return (
    <th className={`px-4 py-3 ${alignment} font-medium text-stone-500`}>
      {children}
    </th>
  );
}

function MoneyCell({
  value,
  locale,
  currency,
  muted = false,
}: {
  value: number | null;
  locale: string;
  currency: string;
  muted?: boolean;
}) {
  return (
    <td className={`px-4 py-3 text-right font-mono tabular-nums ${muted ? "text-stone-500" : "text-stone-700"}`}>
      {value == null ? "—" : formatMoney(value, locale, currency)}
    </td>
  );
}
