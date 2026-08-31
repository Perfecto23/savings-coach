import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calculateYearlyTax } from "@/lib/tax-calculator";
import { SalaryConfigForm } from "@/components/income/salary-config-form";
import { BonusEventsList } from "@/components/income/bonus-events-list";
import { MonthlyForecastTable } from "@/components/income/monthly-forecast-table";
import type { SalaryConfig, BonusEvent, Account } from "@/lib/types/database";
import { getIncomeCopy } from "@/lib/income/presentation";

export default async function IncomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [salaryRes, bonusRes, accountsRes, setupRes] = await Promise.all([
    supabase
      .from("salary_configs")
      .select("id, monthly_gross, housing_fund_rate, housing_fund_base, social_insurance, special_deductions, effective_from, note, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bonus_events")
      .select("id, type, label, amount, expected_date, is_received, actual_amount, target_account_id, note, created_at")
      .eq("owner_id", user.id)
      .order("expected_date"),
    supabase
      .from("accounts")
      .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("sort_order"),
    supabase
      .from("owner_setup")
      .select("locale, base_currency")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (salaryRes.error || bonusRes.error || accountsRes.error || setupRes.error) {
    throw new Error("Unable to load Income");
  }

  const salaryConfig = salaryRes.data as SalaryConfig | null;
  const bonusEvents = (bonusRes.data || []) as BonusEvent[];
  const accounts = (accountsRes.data || []) as Account[];
  const locale = setupRes.data?.locale ?? "en-US";
  const baseCurrency = setupRes.data?.base_currency ?? "USD";
  const copy = getIncomeCopy(locale);

  const breakdown = salaryConfig
    ? calculateYearlyTax({
        monthlyGross: salaryConfig.monthly_gross,
        socialInsurance: salaryConfig.social_insurance,
        housingFundRate: salaryConfig.housing_fund_rate,
        housingFundBase: salaryConfig.housing_fund_base ?? undefined,
        specialDeductions: salaryConfig.special_deductions,
      })
    : [];

  const startYear = salaryConfig
    ? new Date(salaryConfig.effective_from).getFullYear()
    : new Date().getFullYear();

  return (
    <div lang={locale} className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{copy.page.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {copy.page.description}
        </p>
      </div>

      <SalaryConfigForm
        config={salaryConfig}
        locale={locale}
        baseCurrency={baseCurrency}
        copy={copy.salary}
        errorCopy={copy}
      />

      {breakdown.length > 0 && (
        <MonthlyForecastTable
          breakdown={breakdown}
          bonusEvents={bonusEvents}
          startYear={startYear}
          locale={locale}
          baseCurrency={baseCurrency}
          copy={copy.forecast}
        />
      )}

      <BonusEventsList
        initialEvents={bonusEvents}
        accounts={accounts}
        locale={locale}
        baseCurrency={baseCurrency}
        copy={copy}
      />
    </div>
  );
}
