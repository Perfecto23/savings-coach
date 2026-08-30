import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateReportData } from "@/lib/report-generator";
import { MonthlyReport } from "@/components/report/monthly-report";
import type {
  Account,
  BalanceSnapshot,
  MonthlyMilestone,
  SopRecord,
  ImpulseLog,
} from "@/lib/types/database";

interface ReportPageProps {
  params: Promise<{ yearMonth: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { yearMonth } = await params;
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    notFound();
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accountsRes, snapshotsRes, milestoneRes, sopRes, impulseRes, setupRes] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
        .eq("owner_id", user.id)
        .order("sort_order"),
      supabase
        .from("balance_snapshots")
        .select("*")
        .order("recorded_at"),
      supabase
        .from("monthly_milestones")
        .select("id, year_month, planned_savings, planned_total_savings, actual_savings, actual_total_savings, status, created_at, updated_at")
        .eq("owner_id", user.id)
        .eq("year_month", yearMonth)
        .maybeSingle(),
      supabase
        .from("sop_records")
        .select("id, year_month, step_label, due_day, completed, completed_at, amount, note, sort_order, counts_toward_milestone, milestone_amount, created_at")
        .eq("owner_id", user.id)
        .eq("year_month", yearMonth)
        .order("sort_order"),
      supabase
        .from("impulse_logs")
        .select("id, item_name, estimated_price, reason, resisted, logged_at, created_at")
        .eq("owner_id", user.id)
        .eq("resisted", true)
        .order("created_at"),
      supabase
        .from("owner_setup")
        .select("locale, base_currency")
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);

  const reportData = generateReportData({
    yearMonth,
    accounts: (accountsRes.data || []) as Account[],
    snapshots: (snapshotsRes.data || []) as BalanceSnapshot[],
    milestone: milestoneRes.data as MonthlyMilestone | null,
    sopRecords: (sopRes.data || []) as SopRecord[],
    impulseLogs: (impulseRes.data || []) as ImpulseLog[],
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/milestones"
          className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="返回里程碑"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" aria-hidden="true">
            <title>返回</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-stone-950">
            {yearMonth} Monthly report
          </h1>
          <p className="mt-1 text-sm text-gray-500">Plan, confirmations, and Balance Snapshot observations.</p>
        </div>
      </div>

      <MonthlyReport
        data={reportData}
        locale={setupRes.data?.locale || "en-US"}
        baseCurrency={setupRes.data?.base_currency || "USD"}
      />
    </div>
  );
}
