import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MilestoneTable } from "@/components/milestones/milestone-table";
import type { MonthlyMilestone, BonusEvent } from "@/lib/types/database";

function localYearMonth(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}`;
}

export default async function MilestonesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [milestonesRes, bonusRes, setupRes] = await Promise.all([
    supabase
      .from("monthly_milestones")
      .select("id, year_month, planned_savings, planned_total_savings, actual_savings, actual_total_savings, status, is_plan_path, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("year_month"),
    supabase
      .from("bonus_events")
      .select("id, type, label, amount, expected_date, is_received, actual_amount, target_account_id, note, created_at")
      .eq("owner_id", user.id)
      .order("expected_date"),
    supabase
      .from("owner_setup")
      .select("locale, time_zone, base_currency")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const milestones = (milestonesRes.data || []) as MonthlyMilestone[];
  const bonusEvents = (bonusRes.data || []) as BonusEvent[];
  const locale = setupRes.data?.locale || "en-US";
  const baseCurrency = setupRes.data?.base_currency || "USD";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-stone-950">Progress</h1>
          <p className="mt-1 text-sm text-gray-500">
            Compare your Plan Path, Balance Snapshot observations, and execution status without treating them as the same result.
          </p>
      </div>

      <MilestoneTable
        milestones={milestones}
        bonusEvents={bonusEvents}
        locale={locale}
        baseCurrency={baseCurrency}
        currentYearMonth={localYearMonth(setupRes.data?.time_zone || "UTC")}
      />
    </div>
  );
}
