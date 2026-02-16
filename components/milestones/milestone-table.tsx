"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MonthlyMilestone, BonusEvent } from "@/lib/types/database";
import { deleteMilestone } from "@/app/(app)/income/actions";

interface MilestoneTableProps {
  milestones: MonthlyMilestone[];
  bonusEvents: BonusEvent[];
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  pending: { label: "待定", class: "bg-gray-100 text-gray-500" },
  on_track: { label: "达标", class: "bg-green-50 text-green-700" },
  exceeded: { label: "超额", class: "bg-orange-50 text-orange-700" },
  missed: { label: "未达", class: "bg-red-50 text-red-600" },
};

export function MilestoneTable({ milestones: initialMilestones, bonusEvents }: MilestoneTableProps) {
  const currentYM = getCurrentYearMonth();
  const [milestones, setMilestones] = useState(initialMilestones);
  const router = useRouter();

  async function handleDelete(yearMonth: string) {
    if (!window.confirm(`确定删除 ${yearMonth} 的里程碑？`)) return;
    const result = await deleteMilestone(yearMonth);
    if (result.success) {
      setMilestones((prev) => prev.filter((m) => m.year_month !== yearMonth));
      router.refresh();
    }
  }

  function getBonusForMonth(yearMonth: string) {
    return bonusEvents.filter((e) => {
      const ym = e.expected_date.slice(0, 7);
      return ym === yearMonth;
    });
  }

  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          还没有里程碑数据。请先在
          <a href="/income" className="font-medium text-orange-500 hover:text-orange-600">
            收入管理
          </a>
          页配置薪资，然后生成里程碑。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-200 text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">月份</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">计划存入</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">目标余额</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">实际存入</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">实际余额</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">偏差</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">特殊收入</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => {
              const isCurrent = m.year_month === currentYM;
              const isFuture = m.year_month > currentYM;
              const bonuses = getBonusForMonth(m.year_month);
              const deviation =
                m.actual_savings != null
                  ? m.actual_savings - m.planned_savings
                  : null;
              const badge = STATUS_BADGES[m.status] || STATUS_BADGES.pending;

              return (
                <tr
                  key={m.id}
                  className={`border-b border-gray-50 last:border-0 ${
                    isCurrent
                      ? "bg-orange-50/50"
                      : isFuture
                        ? "opacity-50"
                        : ""
                  } ${bonuses.length > 0 ? "bg-amber-50/30" : ""}`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-medium ${isCurrent ? "text-orange-700" : "text-gray-900"}`}>
                      {m.year_month}
                    </span>
                    {isCurrent && (
                      <span className="ml-1 text-xs text-orange-500">当前</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                    ¥{m.planned_savings.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-500">
                    ¥{m.planned_total_savings.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700">
                    {m.actual_savings != null
                      ? `¥${m.actual_savings.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-500">
                    {m.actual_total_savings != null
                      ? `¥${m.actual_total_savings.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {deviation != null ? (
                      <span
                        className={
                          deviation >= 0 ? "text-green-600" : "text-red-500"
                        }
                      >
                        {deviation >= 0 ? "+" : ""}¥{deviation.toLocaleString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.class}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {bonuses.map((b) => (
                      <span
                        key={b.id}
                        className={`mr-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.is_received
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/milestones/${m.year_month}/report`}
                        className="text-xs text-orange-500 hover:text-orange-600 hover:underline"
                      >
                        报告
                      </Link>
                      {m.year_month <= currentYM && m.actual_savings == null && (
                        <button
                          type="button"
                          onClick={() => handleDelete(m.year_month)}
                          className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-red-500"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
