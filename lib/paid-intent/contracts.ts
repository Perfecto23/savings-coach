export type PaidIntentActionState =
  | { status: "idle"; error: null }
  | { status: "success"; error: null }
  | {
      status: "error";
      error: {
        code: "UNAUTHENTICATED" | "NOT_ELIGIBLE" | "RECORD_FAILED";
        message: string;
      };
    };

export const INITIAL_PAID_INTENT_ACTION_STATE: PaidIntentActionState = {
  status: "idle",
  error: null,
};
