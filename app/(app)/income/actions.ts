"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  SalaryConfig,
  BonusEvent,
  MonthlyMilestone,
  SopRecord,
} from "@/lib/types/database";
import {
  getCurrentYearMonth,
  getMilestoneStatus,
  getMilestoneSnapshotForTemplate,
  roundMoney,
  sumMilestoneTarget,
} from "@/lib/milestones";

// ============================================
// 薪资配置
// ============================================

export async function getSalaryConfig(): Promise<ActionResult<SalaryConfig | null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { data, error } = await supabase
    .from("salary_configs")
    .select("id, monthly_gross, housing_fund_rate, housing_fund_base, social_insurance, special_deductions, effective_from, note, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as SalaryConfig | null };
}

export async function saveSalaryConfig(
  formData: FormData
): Promise<ActionResult<SalaryConfig>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const monthlyGross = Number(formData.get("monthly_gross"));
  const housingFundRate = Number(formData.get("housing_fund_rate"));
  const housingFundBaseRaw = formData.get("housing_fund_base");
  const housingFundBase = housingFundBaseRaw ? Number(housingFundBaseRaw) : null;
  const socialInsurance = Number(formData.get("social_insurance"));
  const specialDeductions = Number(formData.get("special_deductions"));

  if (!Number.isFinite(monthlyGross) || monthlyGross < 0) return { success: false, error: "月薪无效" };
  if (!Number.isFinite(housingFundRate) || housingFundRate < 0) return { success: false, error: "公积金比例无效" };
  if (housingFundBase !== null && (!Number.isFinite(housingFundBase) || housingFundBase < 0)) return { success: false, error: "公积金基数无效" };
  if (!Number.isFinite(socialInsurance) || socialInsurance < 0) return { success: false, error: "社保无效" };
  if (!Number.isFinite(specialDeductions) || specialDeductions < 0) return { success: false, error: "专项扣除无效" };

  const payload = {
    owner_id: user.id,
    monthly_gross: monthlyGross,
    housing_fund_rate: housingFundRate,
    housing_fund_base: housingFundBase,
    social_insurance: socialInsurance,
    special_deductions: specialDeductions,
    effective_from: formData.get("effective_from") as string,
    note: (formData.get("note") as string) || null,
  };

  const existingId = formData.get("id") as string;

  let result: { data: SalaryConfig | null; error: { message: string } | null };
  if (existingId) {
    result = await supabase
      .from("salary_configs")
      .update(payload)
      .eq("id", existingId)
      .eq("owner_id", user.id)
      .select("id, monthly_gross, housing_fund_rate, housing_fund_base, social_insurance, special_deductions, effective_from, note, created_at, updated_at")
      .maybeSingle();
  } else {
    result = await supabase
      .from("salary_configs")
      .insert(payload)
      .select("id, monthly_gross, housing_fund_rate, housing_fund_base, social_insurance, special_deductions, effective_from, note, created_at, updated_at")
      .single();
  }

  if (result.error) return { success: false, error: result.error.message };
  if (!result.data) return { success: false, error: "薪资配置不存在" };
  revalidatePath("/income");

  // 薪资变更后自动重新生成里程碑
  await regenerateMilestones();
  return { success: true, data: result.data as SalaryConfig };
}

// ============================================
// 奖金事件
// ============================================

export async function getBonusEvents(): Promise<ActionResult<BonusEvent[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { data, error } = await supabase
    .from("bonus_events")
    .select("id, type, label, amount, expected_date, is_received, actual_amount, target_account_id, note, created_at")
    .eq("owner_id", user.id)
    .order("expected_date");

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as BonusEvent[] };
}

const BONUS_TYPES = ["signing_bonus", "year_end_bonus", "other"] as const;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export async function addBonusEvent(
  formData: FormData
): Promise<ActionResult<BonusEvent>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const type = formData.get("type") as string;
  const amount = Number(formData.get("amount"));
  const expectedDate = formData.get("expected_date") as string;

  if (!BONUS_TYPES.includes(type as (typeof BONUS_TYPES)[number])) return { success: false, error: "奖金类型无效" };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "金额无效" };
  if (!YYYY_MM_DD.test(expectedDate || "")) return { success: false, error: "预期日期格式无效" };

  const { data, error } = await supabase
    .from("bonus_events")
    .insert({
      owner_id: user.id,
      type,
      label: formData.get("label") as string,
      amount,
      expected_date: expectedDate,
      target_account_id: (formData.get("target_account_id") as string) || null,
      note: (formData.get("note") as string) || null,
    })
    .select("id, type, label, amount, expected_date, is_received, actual_amount, target_account_id, note, created_at")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/income");

  await regenerateMilestones();
  return { success: true, data: data as BonusEvent };
}

export async function updateBonusEvent(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const type = formData.get("type") as string;
  const amount = Number(formData.get("amount"));
  const expectedDate = formData.get("expected_date") as string;

  if (!BONUS_TYPES.includes(type as (typeof BONUS_TYPES)[number])) return { success: false, error: "奖金类型无效" };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "金额无效" };
  if (!YYYY_MM_DD.test(expectedDate || "")) return { success: false, error: "预期日期格式无效" };

  const { data, error } = await supabase
    .from("bonus_events")
    .update({
      type,
      label: formData.get("label") as string,
      amount,
      expected_date: expectedDate,
      target_account_id: (formData.get("target_account_id") as string) || null,
      note: (formData.get("note") as string) || null,
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "奖金事件不存在" };
  revalidatePath("/income");

  await regenerateMilestones();
  return { success: true, data: undefined };
}

export async function deleteBonusEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { data, error } = await supabase
    .from("bonus_events")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "奖金事件不存在" };
  revalidatePath("/income");

  await regenerateMilestones();
  return { success: true, data: undefined };
}

export async function markBonusReceived(
  id: string,
  actualAmount: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const { data, error } = await supabase
    .from("bonus_events")
    .update({ is_received: true, actual_amount: actualAmount })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "奖金事件不存在" };
  revalidatePath("/income");

  await regenerateMilestones();
  return { success: true, data: undefined };
}

// ============================================
// 里程碑自动生成
// ============================================

export async function regenerateMilestones(): Promise<ActionResult<MonthlyMilestone[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  // 获取最新薪资配置（确定起始月份）
  const { data: salaryConfig } = await supabase
    .from("salary_configs")
    .select("id, monthly_gross, housing_fund_rate, housing_fund_base, social_insurance, special_deductions, effective_from, note, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!salaryConfig) {
    return { success: false, error: "请先配置薪资信息" };
  }

  const [templatesRes, accountsRes, bonusRes, snapshotsRes, existingMilestonesRes, sopRecordsRes] =
    await Promise.all([
      supabase
        .from("sop_templates")
        .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
        .eq("owner_id", user.id)
        .eq("is_active", true),
      supabase.from("accounts").select("id, purpose").eq("owner_id", user.id),
      supabase
        .from("bonus_events")
        .select("id, type, label, amount, expected_date, is_received, actual_amount, target_account_id, note, created_at")
        .eq("owner_id", user.id)
        .order("expected_date"),
      supabase
        .from("balance_snapshots")
        .select("account_id, balance, recorded_at")
        .order("recorded_at", { ascending: true }),
      supabase
        .from("monthly_milestones")
        .select("id, year_month, planned_savings, planned_total_savings, actual_savings, actual_total_savings, status, created_at, updated_at")
        .eq("owner_id", user.id),
      supabase
        .from("sop_records")
        .select(
          "year_month, completed, counts_toward_milestone, milestone_amount"
        )
        .eq("owner_id", user.id)
        .order("year_month", { ascending: true }),
    ]);

  if (templatesRes.error) return { success: false, error: templatesRes.error.message };
  if (accountsRes.error) return { success: false, error: accountsRes.error.message };
  if (bonusRes.error) return { success: false, error: bonusRes.error.message };
  if (snapshotsRes.error) return { success: false, error: snapshotsRes.error.message };
  if (existingMilestonesRes.error) return { success: false, error: existingMilestonesRes.error.message };
  if (sopRecordsRes.error) return { success: false, error: sopRecordsRes.error.message };

  const templates = templatesRes.data || [];
  const accounts = accountsRes.data || [];
  const bonuses = (bonusRes.data || []) as BonusEvent[];
  const allSnapshots = snapshotsRes.data || [];
  const existingMilestones = (existingMilestonesRes.data || []) as MonthlyMilestone[];
  const sopRecords = (sopRecordsRes.data || []) as Array<
    Pick<SopRecord, "year_month" | "completed" | "counts_toward_milestone" | "milestone_amount">
  >;

  const accountPurposeById = new Map(
    accounts.map((account) => [account.id, account.purpose])
  );

  const savingsAccountIds = new Set(
    accounts
      .filter((account) => account.purpose === "savings")
      .map((account) => account.id)
  );

  const templateMonthlySavings = roundMoney(
    templates.reduce((sum, template) => {
      const snapshot = getMilestoneSnapshotForTemplate({
        toAccountId: template.to_account_id,
        defaultAmount: template.default_amount,
        accountPurposeById,
      });
      return sum + (snapshot.milestone_amount ?? 0);
    }, 0)
  );

  const config = salaryConfig as SalaryConfig;
  const effectiveDate = new Date(config.effective_from);
  const startYear = effectiveDate.getFullYear();
  const startMonth = effectiveDate.getMonth() + 1;
  const currentYM = getCurrentYearMonth();

  const monthlyBalances = new Map<string, number>();
  if (savingsAccountIds.size > 0) {
    const perAccountMonthly = new Map<string, Map<string, number>>();
    for (const snapshot of allSnapshots) {
      if (!savingsAccountIds.has(snapshot.account_id)) continue;
      const d = new Date(snapshot.recorded_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!perAccountMonthly.has(snapshot.account_id)) {
        perAccountMonthly.set(snapshot.account_id, new Map());
      }
      perAccountMonthly.get(snapshot.account_id)!.set(ym, Number(snapshot.balance));
    }

    const allMonths = new Set<string>();
    for (const accountMonths of perAccountMonthly.values()) {
      for (const ym of accountMonths.keys()) allMonths.add(ym);
    }

    for (const ym of allMonths) {
      let total = 0;
      for (const accountMonths of perAccountMonthly.values()) {
        const value = accountMonths.get(ym);
        if (value !== undefined) total += value;
      }
      monthlyBalances.set(ym, roundMoney(total));
    }
  }

  const sortedBalanceMonths = [...monthlyBalances.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const initialBaseline = sortedBalanceMonths.length > 0 ? sortedBalanceMonths[0][1] : 0;

  const existingMap = new Map(
    existingMilestones.map((milestone) => [milestone.year_month, milestone])
  );

  const sopRecordsByMonth = new Map<
    string,
    Array<
      Pick<SopRecord, "year_month" | "completed" | "counts_toward_milestone" | "milestone_amount">
    >
  >();
  for (const record of sopRecords) {
    if (!sopRecordsByMonth.has(record.year_month)) {
      sopRecordsByMonth.set(record.year_month, []);
    }
    sopRecordsByMonth.get(record.year_month)!.push(record);
  }

  type MilestoneRow = {
    year_month: string;
    planned_savings: number;
    planned_total_savings: number;
    actual_savings: number | null;
    actual_total_savings: number | null;
    status: MonthlyMilestone["status"];
  };

  const milestones: MilestoneRow[] = [];
  let anchorBalance = initialBaseline;
  let prevBalance = initialBaseline;
  let cumulativeFromAnchor = 0;

  for (let i = 0; i < 12; i++) {
    const monthOffset = startMonth - 1 + i;
    const year = startYear + Math.floor(monthOffset / 12);
    const month = (monthOffset % 12) + 1;
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

    if (yearMonth <= currentYM && !existingMap.has(yearMonth)) {
      continue;
    }

    const monthRecords = sopRecordsByMonth.get(yearMonth) || [];
    const plannedSopSavings =
      monthRecords.length > 0 ? sumMilestoneTarget(monthRecords) : templateMonthlySavings;

    let monthlySavings = plannedSopSavings;
    for (const bonus of bonuses) {
      const bonusDate = new Date(bonus.expected_date);
      const bonusYM = `${bonusDate.getFullYear()}-${String(bonusDate.getMonth() + 1).padStart(2, "0")}`;
      if (
        bonusYM === yearMonth &&
        bonus.target_account_id &&
        savingsAccountIds.has(bonus.target_account_id)
      ) {
        monthlySavings += Number(bonus.actual_amount ?? bonus.amount);
      }
    }
    monthlySavings = roundMoney(monthlySavings);

    cumulativeFromAnchor = roundMoney(cumulativeFromAnchor + monthlySavings);

    const actualBalance = monthlyBalances.get(yearMonth);
    const actualSavings =
      actualBalance !== undefined ? roundMoney(actualBalance - prevBalance) : null;
    const actualTotal = actualBalance !== undefined ? roundMoney(actualBalance) : null;

    const status = getMilestoneStatus({
      yearMonth,
      currentYearMonth: currentYM,
      records: monthRecords,
    });

    if (actualBalance !== undefined) {
      anchorBalance = actualBalance;
      prevBalance = actualBalance;
      cumulativeFromAnchor = 0;
    }

    const targetBalance = roundMoney(anchorBalance + cumulativeFromAnchor);

    milestones.push({
      year_month: yearMonth,
      planned_savings: monthlySavings,
      planned_total_savings: targetBalance,
      actual_savings: actualSavings,
      actual_total_savings: actualTotal,
      status,
    });
  }

  for (const milestone of milestones) {
    const existing = existingMap.get(milestone.year_month);

    if (existing) {
      const { error: writeError } = await supabase
        .from("monthly_milestones")
        .update({
          planned_savings: milestone.planned_savings,
          planned_total_savings: milestone.planned_total_savings,
          actual_savings: milestone.actual_savings,
          actual_total_savings: milestone.actual_total_savings,
          status: milestone.status,
        })
        .eq("id", existing.id)
        .eq("owner_id", user.id);
      if (writeError) return { success: false, error: writeError.message };
    } else {
      const { error: writeError } = await supabase.from("monthly_milestones").insert({
        ...milestone,
        owner_id: user.id,
      });
      if (writeError) return { success: false, error: writeError.message };
    }
  }

  const { data: result, error } = await supabase
    .from("monthly_milestones")
    .select("id, year_month, planned_savings, planned_total_savings, actual_savings, actual_total_savings, status, created_at, updated_at")
    .eq("owner_id", user.id)
    .order("year_month");

  if (error) return { success: false, error: error.message };

  revalidatePath("/milestones");
  revalidatePath("/");
  return { success: true, data: result as MonthlyMilestone[] };
}

export async function deleteMilestone(yearMonth: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return { success: false, error: "格式无效" };

  const { data, error } = await supabase
    .from("monthly_milestones")
    .delete()
    .eq("year_month", yearMonth)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "里程碑不存在" };
  revalidatePath("/milestones");
  revalidatePath("/");
  return { success: true, data: undefined };
}
