import { createClient } from "@/lib/supabase/server";
import { MilestoneTable } from "@/components/milestones/milestone-table";
import { IncomeTimeline } from "@/components/milestones/income-timeline";
import { RegenerateMilestonesButton } from "@/components/milestones/regenerate-button";
import type { MonthlyMilestone, BonusEvent } from "@/lib/types/database";

export default async function MilestonesPage() {
  const supabase = await createClient();
  const now = Date.now();

  const [milestonesRes, bonusRes] = await Promise.all([
    supabase
      .from("monthly_milestones")
      .select("*")
      .order("year_month"),
    supabase
      .from("bonus_events")
      .select("*")
      .order("expected_date"),
  ]);

  const milestones = (milestonesRes.data || []) as MonthlyMilestone[];
  const bonusEvents = (bonusRes.data || []) as BonusEvent[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">里程碑</h1>
          <p className="mt-1 text-sm text-gray-500">
            追踪每月储蓄目标和收入事件
          </p>
        </div>
        <RegenerateMilestonesButton />
      </div>

      <MilestoneTable milestones={milestones} bonusEvents={bonusEvents} />

      <IncomeTimeline bonusEvents={bonusEvents} now={now} />
    </div>
  );
}
