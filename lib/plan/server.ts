import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_LOCALE } from "@/lib/product-locale";
import type {
  MonthlyActionDto,
  PlanAccountDto,
  PlanPathPointDto,
  PlanRuleDto,
  SavingsPlanPageDto,
} from "./contracts";

interface SetupProjection {
  time_zone: string;
  base_currency: string;
  savings_account_id: string | null;
  plan_activated_at: string | null;
}

interface AccountProjection {
  id: string;
  name: string;
  bank: string | null;
}

interface RuleProjection {
  id: string;
  step_label: string;
  default_amount: number | string | null;
  due_day: number;
  from_account_id: string | null;
  to_account_id: string | null;
  is_active: boolean;
}

interface ActionProjection {
  id: string;
  step_label: string;
  amount: number | string | null;
  rule_amount: number | string | null;
  scheduled_for: string | null;
  completed: boolean;
  source_account_name: string | null;
  target_account_name: string | null;
}

interface PathProjection {
  year_month: string;
  planned_savings: number | string;
  planned_total_savings: number | string;
}

function datePartsInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return new Map(parts.map((part) => [part.type, part.value]));
}

function getLocalDate(timeZone: string) {
  const parts = datePartsInTimeZone(timeZone);
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

function getLocalYearMonth(timeZone: string) {
  return getLocalDate(timeZone).slice(0, 7);
}

function toAccountDto(account: AccountProjection): PlanAccountDto {
  return {
    id: account.id,
    name: account.name,
    institution: account.bank,
  };
}

function toDecimalString(value: number | string | null | undefined) {
  return value == null ? "0" : String(value);
}

export async function getSavingsPlanPage(): Promise<SavingsPlanPageDto> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: setupData, error: setupError } = await supabase
    .from("owner_setup")
    .select("time_zone, base_currency, savings_account_id, plan_activated_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (setupError || !setupData) {
    throw new Error("Unable to load Savings Plan");
  }

  const setup = setupData as SetupProjection;
  if (!setup.savings_account_id) {
    throw new Error("Unable to load Savings Plan");
  }

  const currentYearMonth = getLocalYearMonth(setup.time_zone);
  const localToday = getLocalDate(setup.time_zone);

  const [accountsResult, rulesResult, actionsResult, pathResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, bank")
      .eq("owner_id", user.id)
      .order("sort_order"),
    supabase
      .from("sop_templates")
      .select("id, step_label, default_amount, due_day, from_account_id, to_account_id, is_active")
      .eq("owner_id", user.id)
      .eq("is_plan_rule", true)
      .order("sort_order"),
    supabase
      .from("sop_records")
      .select("id, step_label, amount, rule_amount, scheduled_for, completed, source_account_name, target_account_name")
      .eq("owner_id", user.id)
      .eq("year_month", currentYearMonth)
      .eq("is_monthly_action", true)
      .order("scheduled_for"),
    supabase
      .from("monthly_milestones")
      .select("year_month, planned_savings, planned_total_savings")
      .eq("owner_id", user.id)
      .eq("is_plan_path", true)
      .gte("year_month", currentYearMonth)
      .order("year_month")
      .limit(12),
  ]);

  if (
    accountsResult.error ||
    rulesResult.error ||
    actionsResult.error ||
    pathResult.error
  ) {
    throw new Error("Unable to load Savings Plan");
  }

  const accounts = (accountsResult.data || []) as AccountProjection[];
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const targetAccountProjection = accountById.get(setup.savings_account_id);
  if (!targetAccountProjection) {
    throw new Error("Unable to load Savings Plan");
  }

  const targetAccount = toAccountDto(targetAccountProjection);
  const rules: PlanRuleDto[] = ((rulesResult.data || []) as RuleProjection[]).map(
    (rule) => {
      const ruleTarget = rule.to_account_id
        ? accountById.get(rule.to_account_id)
        : null;
      if (!ruleTarget) throw new Error("Unable to load Savings Plan");

      return {
        id: rule.id,
        name: rule.step_label,
        amount: toDecimalString(rule.default_amount),
        dueDay: rule.due_day,
        sourceAccount:
          rule.from_account_id && accountById.has(rule.from_account_id)
            ? toAccountDto(accountById.get(rule.from_account_id)!)
            : null,
        targetAccount: toAccountDto(ruleTarget),
        active: rule.is_active,
      };
    }
  );

  const currentActions: MonthlyActionDto[] = (
    (actionsResult.data || []) as ActionProjection[]
  ).map((action) => ({
    id: action.id,
    name: action.step_label,
    amount: toDecimalString(action.amount),
    ruleAmount: toDecimalString(action.rule_amount),
    scheduledFor: action.scheduled_for ?? `${currentYearMonth}-01`,
    overdue:
      action.scheduled_for != null &&
      action.scheduled_for < localToday &&
      !action.completed,
    completed: action.completed,
    sourceAccountName: action.source_account_name,
    targetAccountName: action.target_account_name ?? targetAccount.name,
  }));

  const nextAction =
    currentActions.find((action) => !action.completed) ?? currentActions[0] ?? null;
  const monthlyPlannedAmount = rules
    .filter((rule) => rule.active)
    .reduce((sum, rule) => sum + Number(rule.amount), 0);
  const path: PlanPathPointDto[] = ((pathResult.data || []) as PathProjection[]).map(
    (point) => ({
      yearMonth: point.year_month,
      plannedTransfer: toDecimalString(point.planned_savings),
      targetBalance: toDecimalString(point.planned_total_savings),
    })
  );

  return {
    locale: APP_LOCALE,
    baseCurrency: setup.base_currency,
    targetAccount,
    sourceAccounts: accounts
      .filter((account) => account.id !== targetAccount.id)
      .map(toAccountDto),
    isActivated: setup.plan_activated_at != null && path.length === 12,
    monthlyPlannedAmount: String(monthlyPlannedAmount),
    nextAction,
    rules,
    currentActions,
    path,
  };
}
