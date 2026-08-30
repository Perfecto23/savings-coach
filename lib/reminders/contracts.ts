export type ReviewEmailReminderStatus = "disabled" | "enabled";

// This is the complete reminder DTO allowed to cross the RSC boundary.
// It intentionally excludes owner identity, Email, unsubscribe tokens, and
// consent timestamps.
export interface ReviewEmailReminderSettings {
  status: ReviewEmailReminderStatus;
  timeZone: string;
}

export type ReviewEmailReminderActionState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      reminder: ReviewEmailReminderSettings;
    }
  | { status: "error"; message: string };

export const INITIAL_REVIEW_EMAIL_REMINDER_ACTION_STATE: ReviewEmailReminderActionState = {
  status: "idle",
};
