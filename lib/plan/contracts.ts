export type PlanFormErrorCode =
  | "UNAUTHENTICATED"
  | "SETUP_INCOMPLETE"
  | "INVALID_RULE"
  | "RULE_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "TARGET_ACCOUNT_MISMATCH"
  | "PLAN_HAS_NO_RULES"
  | "PLAN_SAVE_FAILED"
  | "PLAN_ACTIVATION_FAILED";

export type PlanFormSuccessCode =
  | "PLAN_RULE_ADDED"
  | "PLAN_RULE_UPDATED"
  | "PLAN_RULE_REACTIVATED"
  | "PLAN_RULE_DEACTIVATED"
  | "SAVINGS_PLAN_ACTIVATED";

export interface PlanFormError {
  code: PlanFormErrorCode;
  field?: "rule_id" | "name" | "amount" | "due_day" | "source_account_id";
}

export type PlanFormState =
  | { status: "idle"; error: null }
  | { status: "success"; error: null; success: PlanFormSuccessCode }
  | { status: "error"; error: PlanFormError };

export const INITIAL_PLAN_FORM_STATE: PlanFormState = {
  status: "idle",
  error: null,
};

export interface PlanAccountDto {
  id: string;
  name: string;
  institution: string | null;
}

export interface PlanRuleDto {
  id: string;
  name: string;
  amount: string;
  dueDay: number;
  sourceAccount: PlanAccountDto | null;
  targetAccount: PlanAccountDto;
  active: boolean;
}

export interface MonthlyActionDto {
  id: string;
  name: string;
  amount: string;
  ruleAmount: string;
  scheduledFor: string;
  overdue: boolean;
  completed: boolean;
  sourceAccountName: string | null;
  targetAccountName: string;
}

export interface PlanPathPointDto {
  yearMonth: string;
  plannedTransfer: string;
  targetBalance: string;
}

export interface SavingsPlanPageDto {
  locale: string;
  baseCurrency: string;
  targetAccount: PlanAccountDto;
  sourceAccounts: PlanAccountDto[];
  isActivated: boolean;
  monthlyPlannedAmount: string;
  nextAction: MonthlyActionDto | null;
  rules: PlanRuleDto[];
  currentActions: MonthlyActionDto[];
  path: PlanPathPointDto[];
}
