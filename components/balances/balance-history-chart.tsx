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
import type { Account, BalanceSnapshot } from "@/lib/types/database";
import { deleteBalanceSnapshotsByDate } from "@/app/(app)/balances/actions";

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
  snapshots: BalanceSnapshot[];
}

export function BalanceHistoryChart({
  accounts,
  snapshots,
}: BalanceHistoryChartProps) {
  const [range, setRange] = useState<"3" | "6" | "all">("all");
  const router = useRouter();

  async function handleDeleteDate(date: string) {
    if (!window.confirm(`确定删除 ${date} 的所有余额记录？`)) return;
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
        暂无余额历史数据，请先录入余额。
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balances]) => ({
      date,
      ...balances,
    }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">余额趋势</h3>

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
            {r === "3" ? "近3月" : r === "6" ? "近6月" : "全部"}
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
              aria-label={`删除 ${d.date} 的记录`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
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
              tickFormatter={(v: number) =>
                v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v)
              }
            />
            <Tooltip
              formatter={(value: number | undefined) => value != null ? `¥${value.toLocaleString()}` : ""}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "13px",
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
