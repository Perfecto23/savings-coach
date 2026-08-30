"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Account } from "@/lib/types/database";
import type { BalanceDisplaySnapshot } from "@/lib/balances/contracts";
import { deleteBalanceSnapshotsByDate } from "@/app/(app)/balances/actions";
import { formatMoney } from "@/lib/format-money";

const ACCOUNT_COLORS: Record<string, string> = {
  salary: "#3b82f6",
  fixed_expense: "#a855f7",
  dating_fund: "#ec4899",
  savings: "#22c55e",
  flexible: "#eab308",
  housing_fund: "#6366f1",
};

interface BalanceHistoryChartProps {
  accounts: Account[];
  snapshots: BalanceDisplaySnapshot[];
  locale: string;
  baseCurrency: string;
}

export function BalanceHistoryChart({
  accounts,
  snapshots,
  locale,
  baseCurrency,
}: BalanceHistoryChartProps) {
  const [range, setRange] = useState<"3" | "6" | "all">("all");
  const router = useRouter();

  async function handleDeleteDate(date: string) {
    if (!window.confirm(`Delete all Balance Snapshots observed on ${date}?`)) return;
    const result = await deleteBalanceSnapshotsByDate(date);
    if (result.success) {
      router.refresh();
    }
  }

  const filteredSnapshots =
    range === "all"
      ? snapshots
      : snapshots.filter((snap) => {
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - Number(range));
          return new Date(snap.recorded_at) >= cutoff;
        });

  if (snapshots.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        No Balance Snapshots yet.
      </div>
    );
  }

  // 按日期聚合为 chart data
  const dateMap = new Map<string, Record<string, number>>();

  for (const snap of filteredSnapshots) {
    const existing = dateMap.get(snap.recorded_at) || {};
    const account = accounts.find((a) => a.id === snap.account_id);
    if (account) {
      existing[account.name] = snap.balance;
    }
    dateMap.set(snap.recorded_at, existing);
  }

  const chartData = Array.from(dateMap.entries())
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([date, balances]) => ({
      date,
      ...balances,
    }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Balance Snapshot history</h3>

      <div className="mt-3 flex gap-2">
        {(["3", "6", "all"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              range === r
                ? "bg-orange-100 text-orange-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {r === "3" ? "3 months" : r === "6" ? "6 months" : "All"}
          </button>
        ))}
      </div>

      {/* 记录日期管理 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {chartData.map((d) => (
          <span
            key={d.date}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
          >
            {d.date}
            <button
              type="button"
              onClick={() => handleDeleteDate(d.date)}
              className="cursor-pointer text-gray-400 transition-colors hover:text-red-500"
              aria-label={`Delete Balance Snapshots for ${d.date}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 h-64 sm:h-80">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 800, height: 320 }}
        >
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              tickFormatter={(value: number) =>
                new Intl.NumberFormat(locale, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)
              }
            />
            <Tooltip
              formatter={(value: number | undefined) =>
                value != null ? formatMoney(value, locale, baseCurrency) : ""
              }
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "14px",
              }}
            />
            <Legend />
            {accounts.map((account) => (
              <Line
                key={account.id}
                type="monotone"
                dataKey={account.name}
                stroke={ACCOUNT_COLORS[account.purpose] || "#9ca3af"}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
