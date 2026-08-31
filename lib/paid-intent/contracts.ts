export type PaidIntentErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_ELIGIBLE"
  | "RECORD_FAILED";

export type PaidIntentActionState =
  | { status: "idle"; error: null }
  | { status: "success"; error: null }
  | {
      status: "error";
      error: {
        code: PaidIntentErrorCode;
      };
    };

export const INITIAL_PAID_INTENT_ACTION_STATE: PaidIntentActionState = {
  status: "idle",
  error: null,
};
