import { SopChecklist } from "@/components/sop/sop-checklist";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SopDisplayRecord } from "@/lib/sop/contracts";
import { MonthSelector } from "./month-selector";
import { getSopCopy } from "@/lib/sop/presentation";
import { APP_LOCALE } from "@/lib/product-locale";

interface SopPageProps {
  searchParams: Promise<{ month?: string }>;
}

function getCurrentYearMonth(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}`;
}

export default async function SopPage({ searchParams }: SopPageProps) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const setupRes = await supabase
    .from("owner_setup")
    .select("time_zone, base_currency, plan_activated_at")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (setupRes.error || !setupRes.data) {
    throw new Error("Unable to load monthly execution settings");
  }
  const yearMonth =
    params.month || getCurrentYearMonth(setupRes.data.time_zone);
  const [recordsRes, reviewRes] = await Promise.all([
    supabase.rpc("get_sop_display_records", {
      p_year_month: yearMonth,
    }),
    supabase
      .from("monthly_milestones")
      .select("review_completed_at")
      .eq("owner_id", user.id)
      .eq("year_month", yearMonth)
      .eq("is_plan_path", true)
      .maybeSingle(),
  ]);

  if (recordsRes.error || reviewRes.error) {
    throw new Error("Unable to load monthly execution steps");
  }
  const displayRecords = (recordsRes.data || []) as SopDisplayRecord[];
  const locale = APP_LOCALE;
  const copy = getSopCopy();

  return (
    <div lang={locale} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{copy.page.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{copy.page.description}</p>
        </div>
        <MonthSelector
          key={yearMonth}
          currentMonth={yearMonth}
          ariaLabel={copy.page.monthAriaLabel}
        />
      </div>

      <SopChecklist
        initialRecords={displayRecords}
        yearMonth={yearMonth}
        locale={locale}
        baseCurrency={setupRes.data.base_currency}
        isPlanActivated={setupRes.data.plan_activated_at != null}
        isClosed={reviewRes.data?.review_completed_at != null}
        copy={copy.checklist}
        stepCopy={copy.step}
        errorCopy={copy.errors}
      />
    </div>
  );
}
