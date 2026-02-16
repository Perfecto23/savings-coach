"use client";

import type { MonthlyMilestone } from "@/lib/types/database";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StreakCounter } from "@/components/ui/streak-counter";

interface SavingsProgressCardProps {
  milestones: MonthlyMilestone[];
  totalSavings: number;
}

export function SavingsProgressCard({
  milestones,
  totalSavings,
}: SavingsProgressCardProps) {
  const completed = milestones.filter(
    (m) => m.status === "on_track" || m.status === "exceeded"
  ).length;
  const total = milestones.filter((m) => m.status !== "pending").length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 计算连胜
  let streak = 0;
  const sorted = [...milestones].sort((a, b) =>
    b.year_month.localeCompare(a.year_month)
  );
  for (const m of sorted) {
    if (m.status === "on_track" || m.status === "exceeded") {
      streak++;
    } else if (m.status === "missed") {
      break;
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <ProgressRing
            progress={progressPct}
            size={100}
            strokeWidth={8}
            label={`${progressPct}%`}
            sublabel={`${completed}/${total}`}
          />
          <div>
            <p className="text-sm font-medium text-gray-500">累计存款总额</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              ¥{totalSavings.toLocaleString()}
            </p>
            <div className="mt-2">
              <StreakCounter count={streak} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            里程碑进度: {completed}/{total}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-orange-400 to-orange-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
