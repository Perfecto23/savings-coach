export type MonthlyReviewErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_MONTH"
  | "MONTH_NOT_AVAILABLE"
  | "ACTIONS_INCOMPLETE"
  | "PLAN_NOT_READY"
  | "REVIEW_FAILED";

export interface MonthlyReviewError {
  code: MonthlyReviewErrorCode;
}

export type MonthlyReviewActionState =
  | { status: "idle"; error: null }
  | {
      status: "success";
      error: null;
      reviewedYearMonth: string;
      reviewCompletedAt: string;
      nextYearMonth: string;
    }
  | { status: "error"; error: MonthlyReviewError };

export const INITIAL_MONTHLY_REVIEW_ACTION_STATE: MonthlyReviewActionState = {
  status: "idle",
  error: null,
};
