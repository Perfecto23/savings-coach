import Link from "next/link";
import type { SopRecord, MonthlyMilestone } from "@/lib/types/database";

interface CurrentMonthCardProps {
  sopRecords: SopRecord[];
  milestone: MonthlyMilestone | null;
}

export function CurrentMonthCard({ sopRecords, milestone }: CurrentMonthCardProps) {
  const completed = sopRecords.filter((r) => r.completed).length;
  const total = sopRecords.length;
  const nextTodo = sopRecords.find((r) => !r.completed);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-500">本月状态</h3>

      <div className="mt-3 space-y-3">
        {/* SOP 进度 */}
        <Link
          href="/sop"
          className="block cursor-pointer rounded-lg bg-gray-50 p-3 transition-colors hover:bg-orange-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">SOP 进度</span>
            <span className="text-sm font-semibold text-orange-600">
              {completed}/{total}
            </span>
          </div>
          {nextTodo && (
            <p className="mt-1 text-xs text-gray-500">
              下一步: {nextTodo.step_label}（{nextTodo.due_day}号）
            </p>
          )}
        </Link>

        {/* 里程碑 */}
        {milestone && (
          <Link
            href="/milestones"
            className="block cursor-pointer rounded-lg bg-gray-50 p-3 transition-colors hover:bg-orange-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                储蓄目标
              </span>
              <span className="text-sm font-mono text-gray-600">
                ¥{milestone.planned_savings.toLocaleString()}
              </span>
            </div>
            {milestone.actual_savings != null && (
              <p className="mt-1 text-xs text-gray-500">
                实际: ¥{milestone.actual_savings.toLocaleString()}
              </p>
            )}
          </Link>
        )}
      </div>
    </div>
  );
}
