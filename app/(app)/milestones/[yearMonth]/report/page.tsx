import Link from "next/link";
import { notFound } from "next/navigation";
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

  const [accountsRes, snapshotsRes, milestoneRes, sopRes, impulseRes] =
    await Promise.all([
      supabase.from("accounts").select("*").order("sort_order"),
      supabase
        .from("balance_snapshots")
        .select("*")
        .order("recorded_at"),
      supabase
        .from("monthly_milestones")
        .select("*")
        .eq("year_month", yearMonth)
        .maybeSingle(),
      supabase
        .from("sop_records")
        .select("*")
        .eq("year_month", yearMonth)
        .order("sort_order"),
      supabase
        .from("impulse_logs")
        .select("*")
        .eq("resisted", true)
        .order("created_at"),
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
          <h1 className="text-2xl font-bold text-gray-900">
            {yearMonth} 月度报告
          </h1>
          <p className="mt-1 text-sm text-gray-500">本月财务总结</p>
        </div>
      </div>

      <MonthlyReport data={reportData} />
    </div>
  );
}
