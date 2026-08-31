export type ReviewEmailReminderStatus = "disabled" | "enabled";

// This is the complete reminder DTO allowed to cross the RSC boundary.
// It intentionally excludes owner identity, Email, unsubscribe tokens, and
// consent timestamps.
export interface ReviewEmailReminderSettings {
  status: ReviewEmailReminderStatus;
  timeZone: string;
}

export type ReviewEmailReminderErrorCode =
  | "FEATURE_DISABLED"
  | "CONSENT_REQUIRED"
  | "INVALID_REQUEST"
  | "UNAUTHENTICATED"
  | "LOAD_FAILED"
  | "EMAIL_UNCONFIRMED"
  | "SETUP_INCOMPLETE"
  | "UPDATE_FAILED"
  | "INVALID_RECEIPT";

export type ReviewEmailReminderActionState =
  | { status: "idle" }
  | {
      status: "success";
      result: "enabled" | "unsubscribed";
      reminder: ReviewEmailReminderSettings;
    }
  | { status: "error"; code: ReviewEmailReminderErrorCode };

export const INITIAL_REVIEW_EMAIL_REMINDER_ACTION_STATE: ReviewEmailReminderActionState = {
  status: "idle",
};
