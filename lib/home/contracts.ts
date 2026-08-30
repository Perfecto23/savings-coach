export type HomeActionErrorCode =
  | "UNAUTHENTICATED"
  | "ACTION_NOT_FOUND"
  | "INVALID_ACTION"
  | "ACTION_UPDATE_FAILED";

export interface HomeActionError {
  code: HomeActionErrorCode;
  message: string;
}

export type HomeActionState =
  | { status: "idle"; error: null }
  | {
      status: "success";
      error: null;
      operation: "complete" | "undo";
      behaviorActivatedNow: boolean;
    }
  | { status: "error"; error: HomeActionError };

export const INITIAL_HOME_ACTION_STATE: HomeActionState = {
  status: "idle",
  error: null,
};

export interface HomeMonthlyActionDto {
  id: string;
  name: string;
  amount: string;
  scheduledFor: string;
  dueStatus: "overdue" | "today" | "upcoming";
  sourceAccountName: string | null;
  targetAccountName: string;
}

export interface HomePlanSummaryDto {
  plannedTransfer: string;
  targetBalance: string;
}

interface MonthlyExecutionHomeBase {
  locale: string;
  baseCurrency: string;
  currentYearMonth: string;
  completedCount: number;
  totalCount: number;
  planSummary: HomePlanSummaryDto | null;
}

export type MonthlyExecutionHomeDto =
  | (MonthlyExecutionHomeBase & {
      status: "needs_plan";
      nextAction: null;
      lastCompletedAction: null;
    })
  | (MonthlyExecutionHomeBase & {
      status: "ready";
      nextAction: HomeMonthlyActionDto;
      lastCompletedAction: HomeMonthlyActionDto | null;
    })
  | (MonthlyExecutionHomeBase & {
      status: "complete";
      nextAction: null;
      lastCompletedAction: HomeMonthlyActionDto;
    })
  | (MonthlyExecutionHomeBase & {
      status: "needs_repair";
      nextAction: null;
      lastCompletedAction: null;
    });
