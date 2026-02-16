import { createClient } from "@/lib/supabase/server";
import { calculateYearlyTax } from "@/lib/tax-calculator";
import { SalaryConfigForm } from "@/components/income/salary-config-form";
import { BonusEventsList } from "@/components/income/bonus-events-list";
import { MonthlyForecastTable } from "@/components/income/monthly-forecast-table";
import type { SalaryConfig, BonusEvent, Account } from "@/lib/types/database";

export default async function IncomePage() {
  const supabase = await createClient();

  const [salaryRes, bonusRes, accountsRes] = await Promise.all([
    supabase
      .from("salary_configs")
      .select("*")
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("bonus_events").select("*").order("expected_date"),
    supabase.from("accounts").select("*").order("sort_order"),
  ]);

  const salaryConfig = salaryRes.data as SalaryConfig | null;
  const bonusEvents = (bonusRes.data || []) as BonusEvent[];
  const accounts = (accountsRes.data || []) as Account[];

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">收入管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          配置薪资、查看月度预测、管理奖金事件
        </p>
      </div>

      <SalaryConfigForm config={salaryConfig} />

      {breakdown.length > 0 && (
        <MonthlyForecastTable
          breakdown={breakdown}
          bonusEvents={bonusEvents}
          startYear={startYear}
        />
      )}

      <BonusEventsList initialEvents={bonusEvents} accounts={accounts} />
    </div>
  );
}
