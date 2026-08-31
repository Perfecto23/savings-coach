"use server";

import { revalidatePath } from "next/cache";
import {
  type PlanFormError,
  type PlanFormState,
} from "@/lib/plan/contracts";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_PATTERN = /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;

const RPC_ERRORS: Record<string, PlanFormError> = {
  unauthenticated: {
    code: "UNAUTHENTICATED",
  },
  setup_incomplete: {
    code: "SETUP_INCOMPLETE",
  },
  invalid_rule_id: {
    code: "INVALID_RULE",
    field: "rule_id",
  },
  invalid_rule_name: {
    code: "INVALID_RULE",
    field: "name",
  },
  invalid_rule_amount: {
    code: "INVALID_RULE",
    field: "amount",
  },
  invalid_rule: {
    code: "INVALID_RULE",
  },
  invalid_due_day: {
    code: "INVALID_RULE",
    field: "due_day",
  },
  account_not_found: {
    code: "ACCOUNT_NOT_FOUND",
    field: "source_account_id",
  },
  source_account_not_found: {
    code: "ACCOUNT_NOT_FOUND",
    field: "source_account_id",
  },
  target_account_mismatch: {
    code: "TARGET_ACCOUNT_MISMATCH",
  },
  rule_not_found: {
    code: "RULE_NOT_FOUND",
  },
  plan_has_no_rules: {
    code: "PLAN_HAS_NO_RULES",
  },
  no_active_plan_rules: {
    code: "PLAN_HAS_NO_RULES",
  },
  legacy_action_conflict: {
    code: "PLAN_ACTIVATION_FAILED",
  },
  plan_path_incomplete: {
    code: "PLAN_ACTIVATION_FAILED",
  },
};

function errorState(error: PlanFormError): PlanFormState {
  return { status: "error", error };
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function mapRpcError(
  error: { code?: string; message?: string },
  fallback: "PLAN_SAVE_FAILED" | "PLAN_ACTIVATION_FAILED"
): PlanFormState {
  if (error.code === "P0001" && error.message && RPC_ERRORS[error.message]) {
    return errorState(RPC_ERRORS[error.message]);
  }

  return errorState({
    code: fallback,
  });
}

function validateRule(formData: FormData) {
  const ruleId = readString(formData, "rule_id");
  if (!UUID_PATTERN.test(ruleId)) {
    return errorState(RPC_ERRORS.invalid_rule_id);
  }

  const name = readString(formData, "name");
  if (!name || name.length > 100) {
    return errorState(RPC_ERRORS.invalid_rule_name);
  }

  const amount = readString(formData, "amount");
  if (!MONEY_PATTERN.test(amount)) {
    return errorState(RPC_ERRORS.invalid_rule_amount);
  }

  const dueDayInput = readString(formData, "due_day");
  const dueDay = Number(dueDayInput);
  if (!/^\d{1,2}$/.test(dueDayInput) || dueDay < 1 || dueDay > 31) {
    return errorState(RPC_ERRORS.invalid_due_day);
  }

  const sourceAccountId = readString(formData, "source_account_id");
  if (sourceAccountId && !UUID_PATTERN.test(sourceAccountId)) {
    return errorState(RPC_ERRORS.source_account_not_found);
  }

  const targetAccountId = readString(formData, "target_account_id");
  if (!UUID_PATTERN.test(targetAccountId)) {
    return errorState(RPC_ERRORS.target_account_mismatch);
  }

  return {
    ruleId,
    name,
    amount,
    dueDay,
    sourceAccountId: sourceAccountId || null,
    targetAccountId,
  };
}

async function saveRule(
  formData: FormData,
  success: "PLAN_RULE_ADDED" | "PLAN_RULE_UPDATED"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(RPC_ERRORS.unauthenticated);

  const rule = validateRule(formData);
  if ("status" in rule) return rule;

  const { error } = await supabase.rpc("save_plan_rule", {
    p_rule: {
      rule_id: rule.ruleId,
      name: rule.name,
      amount: rule.amount,
      due_day: rule.dueDay,
      source_account_id: rule.sourceAccountId,
      target_account_id: rule.targetAccountId,
    },
  });

  if (error) return mapRpcError(error, "PLAN_SAVE_FAILED");
  revalidatePlanPaths();
  return { status: "success", error: null, success } as const;
}

function revalidatePlanPaths() {
  revalidatePath("/plan");
  revalidatePath("/sop");
  revalidatePath("/milestones");
  revalidatePath("/");
}

export async function createPlanRule(
  _previousState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  void _previousState;
  return saveRule(formData, "PLAN_RULE_ADDED");
}

export async function updatePlanRule(
  _previousState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  void _previousState;
  return saveRule(formData, "PLAN_RULE_UPDATED");
}

export async function setPlanRuleActive(
  ruleId: string,
  active: boolean
): Promise<PlanFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(RPC_ERRORS.unauthenticated);
  if (!UUID_PATTERN.test(ruleId)) return errorState(RPC_ERRORS.invalid_rule_id);

  const { error } = await supabase.rpc("set_plan_rule_active", {
    p_rule_id: ruleId,
    p_active: active,
  });
  if (error) return mapRpcError(error, "PLAN_SAVE_FAILED");

  revalidatePlanPaths();
  return {
    status: "success",
    error: null,
    success: active ? "PLAN_RULE_REACTIVATED" : "PLAN_RULE_DEACTIVATED",
  };
}

export async function activateSavingsPlan(
  _previousState: PlanFormState,
  _formData: FormData
): Promise<PlanFormState> {
  void _previousState;
  void _formData;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorState(RPC_ERRORS.unauthenticated);

  const { error } = await supabase.rpc("activate_savings_plan");
  if (error) return mapRpcError(error, "PLAN_ACTIVATION_FAILED");

  revalidatePlanPaths();
  return {
    status: "success",
    error: null,
    success: "SAVINGS_PLAN_ACTIVATED",
  };
}
