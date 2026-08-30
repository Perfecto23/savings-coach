import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  generateReportData,
  type MonthlyReportAccount,
  type MonthlyReportImpulse,
  type MonthlyReportMilestone,
  type MonthlyReportSnapshot,
  type MonthlyReportSopRecord,
} from "@/lib/report-generator";
import { MonthlyReport } from "@/components/report/monthly-report";
import { MonthlyReviewPanel } from "@/components/report/monthly-review-panel";
import { ProBetaOffer } from "@/components/report/pro-beta-offer";

interface ReportPageProps {
  params: Promise<{ yearMonth: string }>;
}

interface PaidIntentOfferState {
  offer_code: string;
  eligible: boolean;
  recorded_at: string | null;
}

const PAID_INTENT_OFFER_CODE = "pro_beta_usd_499_monthly_v1";

function currentYearMonthInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}`;
}

function previousYearMonth(currentYearMonth: string) {
  const currentMonth = new Date(`${currentYearMonth}-01T00:00:00.000Z`);
  currentMonth.setUTCMonth(currentMonth.getUTCMonth() - 1);
  return currentMonth.toISOString().slice(0, 7);
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { yearMonth } = await params;
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    notFound();
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    accountsRes,
    snapshotsRes,
    milestoneRes,
    sopRes,
    impulseRes,
    setupRes,
    paidIntentRes,
  ] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, icon")
        .eq("owner_id", user.id)
        .order("sort_order"),
      supabase
        .from("balance_snapshots")
        .select("account_id, recorded_at, balance")
        .order("recorded_at"),
      supabase
        .from("monthly_milestones")
        .select("year_month, planned_savings, actual_savings, is_plan_path, review_completed_at")
        .eq("owner_id", user.id)
        .eq("year_month", yearMonth)
        .maybeSingle(),
      supabase
        .from("sop_records")
        .select("id, step_label, completed, amount, scheduled_for")
        .eq("owner_id", user.id)
        .eq("year_month", yearMonth)
        .order("sort_order"),
      supabase
        .from("impulse_logs")
        .select("estimated_price, resisted, logged_at")
        .eq("owner_id", user.id)
        .eq("resisted", true)
        .order("created_at"),
      supabase
        .from("owner_setup")
        .select("locale, time_zone, base_currency")
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase.rpc("get_paid_intent_offer_state"),
    ]);

  if (paidIntentRes.error) {
    throw new Error("Unable to load Pro beta offer state");
  }

  const sopRecords = (sopRes.data || []) as MonthlyReportSopRecord[];
  const reportData = generateReportData({
    yearMonth,
    accounts: (accountsRes.data || []) as MonthlyReportAccount[],
    snapshots: (snapshotsRes.data || []) as MonthlyReportSnapshot[],
    milestone: milestoneRes.data as MonthlyReportMilestone | null,
    sopRecords,
    impulseLogs: (impulseRes.data || []) as MonthlyReportImpulse[],
  });
  const monthlyActions = sopRecords.filter(
    (record) => record.scheduled_for != null
  );
  const completedMonthlyActions = monthlyActions.filter(
    (record) => record.completed
  ).length;
  const locale = setupRes.data?.locale || "en-US";
  const currentYearMonth = currentYearMonthInTimeZone(
    setupRes.data?.time_zone || "UTC"
  );
  const previousReviewYearMonth = previousYearMonth(currentYearMonth);
  const paidIntentState = paidIntentRes.data as PaidIntentOfferState | null;
  if (
    !paidIntentState ||
    paidIntentState.offer_code !== PAID_INTENT_OFFER_CODE ||
    typeof paidIntentState.eligible !== "boolean"
  ) {
    throw new Error("Invalid Pro beta offer state");
  }

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

      <MonthlyReviewPanel
        yearMonth={yearMonth}
        currentYearMonth={currentYearMonth}
        locale={locale}
        reviewCompletedAt={reportData.milestone?.review_completed_at ?? null}
        isReviewWindow={
          yearMonth === previousReviewYearMonth &&
          reportData.milestone?.is_plan_path === true
        }
        completedCount={completedMonthlyActions}
        totalCount={monthlyActions.length}
      />

      <ProBetaOffer
        eligible={
          paidIntentState.eligible &&
          reportData.milestone?.review_completed_at != null
        }
        recorded={paidIntentState.recorded_at != null}
      />

      <MonthlyReport
        data={reportData}
        locale={locale}
        baseCurrency={setupRes.data?.base_currency || "USD"}
      />
    </div>
  );
}
