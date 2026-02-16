"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  SalaryConfig,
  BonusEvent,
  MonthlyMilestone,
} from "@/lib/types/database";

// ============================================
// 薪资配置
// ============================================

export async function getSalaryConfig(): Promise<ActionResult<SalaryConfig | null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { data, error } = await supabase
    .from("salary_configs")
    .select("*")
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
      .select()
      .single();
  } else {
    result = await supabase
      .from("salary_configs")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) return { success: false, error: result.error.message };
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
    .select("*")
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
      type,
      label: formData.get("label") as string,
      amount,
      expected_date: expectedDate,
      target_account_id: (formData.get("target_account_id") as string) || null,
      note: (formData.get("note") as string) || null,
    })
    .select()
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

  const { error } = await supabase
    .from("bonus_events")
    .update({
      type,
      label: formData.get("label") as string,
      amount,
      expected_date: expectedDate,
      target_account_id: (formData.get("target_account_id") as string) || null,
      note: (formData.get("note") as string) || null,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/income");

  await regenerateMilestones();
  return { success: true, data: undefined };
}

export async function deleteBonusEvent(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { error } = await supabase.from("bonus_events").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
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

  const { error } = await supabase
    .from("bonus_events")
    .update({ is_received: true, actual_amount: actualAmount })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/income");

  await regenerateMilestones();
  return { success: true, data: undefined };
}

// ============================================
// 里程碑自动生成
// ============================================

export async function regenerateMilestones(): Promise<ActionResult<MonthlyMilestone[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  // 获取最新薪资配置（确定起始月份）
  const { data: salaryConfig } = await supabase
    .from("salary_configs")
    .select("*")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!salaryConfig) {
    return { success: false, error: "请先配置薪资信息" };
  }

  // 并行获取: SOP 模板、账户、奖金事件
  const [templatesRes, accountsRes, bonusRes] = await Promise.all([
    supabase.from("sop_templates").select("*").eq("is_active", true),
    supabase.from("accounts").select("*"),
    supabase.from("bonus_events").select("*").order("expected_date"),
  ]);

  const templates = templatesRes.data || [];
  const accounts = (accountsRes.data || []) as Array<{ id: string; purpose: string }>;
  const bonuses = (bonusRes.data || []) as BonusEvent[];

  // 找出所有 purpose='savings' 的账户 ID
  const savingsAccountIds = new Set(
    accounts.filter((a) => a.purpose === "savings").map((a) => a.id)
  );

  // 从 SOP 模板计算每月固定储蓄目标：
  // 只统计 to_account 为储蓄账户且有默认金额的模板
  let monthlySopSavings = 0;
  for (const tpl of templates) {
    if (tpl.to_account_id && savingsAccountIds.has(tpl.to_account_id) && tpl.default_amount) {
      monthlySopSavings += Number(tpl.default_amount);
    }
  }

  // 确定起始年月
  const config = salaryConfig as SalaryConfig;
  const effectiveDate = new Date(config.effective_from);
  const startYear = effectiveDate.getFullYear();
  const startMonth = effectiveDate.getMonth() + 1;

  // 当前年月
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 获取储蓄账户的所有余额快照（按月分组，取每月最新一条）
  const monthlyBalances = new Map<string, number>();
  if (savingsAccountIds.size > 0) {
    const { data: allSnapshots } = await supabase
      .from("balance_snapshots")
      .select("account_id, balance, recorded_at")
      .in("account_id", [...savingsAccountIds])
      .order("recorded_at", { ascending: true });

    // 按月分组每个账户的余额（同月取最新值），再汇总所有储蓄账户
    const perAccountMonthly = new Map<string, Map<string, number>>();
    for (const snap of allSnapshots || []) {
      const d = new Date(snap.recorded_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!perAccountMonthly.has(snap.account_id)) {
        perAccountMonthly.set(snap.account_id, new Map());
      }
      perAccountMonthly.get(snap.account_id)!.set(ym, Number(snap.balance));
    }
    // 合并所有储蓄账户，按月汇总
    const allMonths = new Set<string>();
    for (const acctMap of perAccountMonthly.values()) {
      for (const ym of acctMap.keys()) allMonths.add(ym);
    }
    for (const ym of allMonths) {
      let total = 0;
      for (const acctMap of perAccountMonthly.values()) {
        const val = acctMap.get(ym);
        if (val !== undefined) total += val;
      }
      monthlyBalances.set(ym, total);
    }
  }

  // 确定初始 baseline（最早的储蓄余额快照，作为第一个锚点）
  // 按时间排序取最早的月份余额
  const sortedBalanceMonths = [...monthlyBalances.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const initialBaseline = sortedBalanceMonths.length > 0 ? sortedBalanceMonths[0][1] : 0;

  // 获取已有里程碑
  const { data: existingMilestones } = await supabase
    .from("monthly_milestones")
    .select("*");

  const existingMap = new Map(
    (existingMilestones || []).map((m) => [m.year_month, m])
  );

  // 构建里程碑：滚动锚点模式
  // - 锚点 = 最后一个有实际余额数据的月份的余额
  // - 后续月份目标 = 锚点 + 累计计划存入
  type MilestoneRow = {
    year_month: string;
    planned_savings: number;
    planned_total_savings: number;
    actual_savings: number | null;
    actual_total_savings: number | null;
    status: string;
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

    // 跳过已开始且没有历史数据的月份
    if (yearMonth <= currentYM && !existingMap.has(yearMonth)) {
      continue;
    }

    // 每月计划储蓄 = SOP 金额 + 奖金
    let monthlySavings = monthlySopSavings;
    for (const bonus of bonuses) {
      const bonusDate = new Date(bonus.expected_date);
      const bonusYM = `${bonusDate.getFullYear()}-${String(bonusDate.getMonth() + 1).padStart(2, "0")}`;
      if (bonusYM === yearMonth && bonus.target_account_id && savingsAccountIds.has(bonus.target_account_id)) {
        monthlySavings += bonus.actual_amount ?? bonus.amount;
      }
    }

    cumulativeFromAnchor += monthlySavings;

    // 检查该月是否有实际余额数据（来自 balance_snapshots）
    const actualBalance = monthlyBalances.get(yearMonth);
    let actualSavings: number | null = null;
    let actualTotal: number | null = null;
    let status = "pending";

    if (actualBalance !== undefined) {
      actualTotal = actualBalance;
      actualSavings = Math.round((actualBalance - prevBalance) * 100) / 100;

      const deviation = actualSavings - monthlySavings;
      if (deviation >= 0) {
        status = deviation > 0 ? "exceeded" : "on_track";
      } else {
        status = "missed";
      }

      // 该月成为新锚点，后续月份从这里重新计算
      anchorBalance = actualBalance;
      prevBalance = actualBalance;
      cumulativeFromAnchor = 0;
    }

    const targetBalance = Math.round((anchorBalance + cumulativeFromAnchor) * 100) / 100;

    milestones.push({
      year_month: yearMonth,
      planned_savings: Math.round(monthlySavings * 100) / 100,
      planned_total_savings: targetBalance,
      actual_savings: actualSavings,
      actual_total_savings: actualTotal,
      status,
    });
  }

  // Upsert 里程碑
  for (const ms of milestones) {
    const existing = existingMap.get(ms.year_month);

    if (existing) {
      await supabase
        .from("monthly_milestones")
        .update({
          planned_savings: ms.planned_savings,
          planned_total_savings: ms.planned_total_savings,
          actual_savings: ms.actual_savings,
          actual_total_savings: ms.actual_total_savings,
          status: ms.status,
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("monthly_milestones")
        .insert(ms);
    }
  }

  // 返回最新里程碑
  const { data: result, error } = await supabase
    .from("monthly_milestones")
    .select("*")
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

  const { error } = await supabase
    .from("monthly_milestones")
    .delete()
    .eq("year_month", yearMonth);

  if (error) return { success: false, error: error.message };
  revalidatePath("/milestones");
  revalidatePath("/");
  return { success: true, data: undefined };
}
