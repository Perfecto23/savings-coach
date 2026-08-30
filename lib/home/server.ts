import "server-only";

import { redirect } from "next/navigation";
import type {
  HomeMonthlyActionDto,
  HomePlanSummaryDto,
  MonthlyExecutionHomeDto,
} from "@/lib/home/contracts";
import { createClient } from "@/lib/supabase/server";

interface HomeSetupProjection {
  locale: string;
  time_zone: string;
  base_currency: string;
  plan_activated_at: string | null;
}

interface HomeActionProjection {
  id: string;
  step_label: string;
  amount: number | string | null;
  scheduled_for: string | null;
  source_account_name: string | null;
  target_account_name: string | null;
  completed: boolean;
  completed_at: string | null;
}

interface HomePathProjection {
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

function toActionDto(
  action: HomeActionProjection,
  localToday: string
): HomeMonthlyActionDto | null {
  if (!action.scheduled_for || !action.target_account_name) return null;

  return {
    id: action.id,
    name: action.step_label,
    amount: String(action.amount ?? 0),
    scheduledFor: action.scheduled_for,
    dueStatus:
      action.scheduled_for < localToday
        ? "overdue"
        : action.scheduled_for === localToday
          ? "today"
          : "upcoming",
    sourceAccountName: action.source_account_name,
    targetAccountName: action.target_account_name,
  };
}

function emptyHomeBase(setup: HomeSetupProjection, currentYearMonth: string) {
  return {
    locale: setup.locale,
    baseCurrency: setup.base_currency,
    currentYearMonth,
    completedCount: 0,
    totalCount: 0,
    planSummary: null,
  };
}

export async function getMonthlyExecutionHome(): Promise<MonthlyExecutionHomeDto> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: setupData, error: setupError } = await supabase
    .from("owner_setup")
    .select("locale, time_zone, base_currency, plan_activated_at")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (setupError || !setupData) throw new Error("Unable to load Home");

  const setup = setupData as HomeSetupProjection;
  const localToday = getLocalDate(setup.time_zone);
  const currentYearMonth = localToday.slice(0, 7);

  const [actionsResult, pathResult] = await Promise.all([
    supabase
      .from("sop_records")
      .select("id, step_label, amount, scheduled_for, source_account_name, target_account_name, completed, completed_at, sort_order")
      .eq("owner_id", user.id)
      .eq("year_month", currentYearMonth)
      .eq("is_monthly_action", true)
      .eq("counts_toward_milestone", true)
      .order("scheduled_for")
      .order("sort_order")
      .order("id"),
    supabase
      .from("monthly_milestones")
      .select("planned_savings, planned_total_savings")
      .eq("owner_id", user.id)
      .eq("year_month", currentYearMonth)
      .eq("is_plan_path", true)
      .maybeSingle(),
  ]);
  if (actionsResult.error || pathResult.error) {
    throw new Error("Unable to load Home");
  }

  const base = emptyHomeBase(setup, currentYearMonth);
  if (!setup.plan_activated_at) {
    return {
      ...base,
      status: "needs_plan",
      nextAction: null,
      lastCompletedAction: null,
    };
  }

  if (!pathResult.data) {
    return {
      ...base,
      status: "needs_repair",
      nextAction: null,
      lastCompletedAction: null,
    };
  }

  const actions = (actionsResult.data || []) as HomeActionProjection[];
  const planSummary: HomePlanSummaryDto = {
    plannedTransfer: String(
      (pathResult.data as HomePathProjection).planned_savings
    ),
    targetBalance: String(
      (pathResult.data as HomePathProjection).planned_total_savings
    ),
  };
  if (actions.length === 0) {
    return {
      ...base,
      planSummary,
      status: "needs_repair",
      nextAction: null,
      lastCompletedAction: null,
    };
  }

  const completedActions = actions.filter((action) => action.completed);
  const incompleteAction = actions.find((action) => !action.completed) ?? null;
  const lastCompletedProjection = completedActions.reduce<HomeActionProjection | null>(
    (latest, action) => {
      if (!latest) return action;
      return (action.completed_at ?? "") > (latest.completed_at ?? "")
        ? action
        : latest;
    },
    null
  );
  const lastCompletedAction = lastCompletedProjection
    ? toActionDto(lastCompletedProjection, localToday)
    : null;
  const nextAction = incompleteAction
    ? toActionDto(incompleteAction, localToday)
    : null;
  const populatedBase = {
    ...base,
    completedCount: completedActions.length,
    totalCount: actions.length,
    planSummary,
  };

  if (incompleteAction && !nextAction) {
    return {
      ...populatedBase,
      status: "needs_repair",
      nextAction: null,
      lastCompletedAction: null,
    };
  }

  if (nextAction) {
    return {
      ...populatedBase,
      status: "ready",
      nextAction,
      lastCompletedAction,
    };
  }

  if (!lastCompletedAction) {
    return {
      ...populatedBase,
      status: "needs_repair",
      nextAction: null,
      lastCompletedAction: null,
    };
  }

  return {
    ...populatedBase,
    status: "complete",
    nextAction: null,
    lastCompletedAction,
  };
}
