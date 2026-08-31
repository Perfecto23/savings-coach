"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { configureReviewEmailReminder } from "@/app/(app)/settings/actions";
import {
  INITIAL_REVIEW_EMAIL_REMINDER_ACTION_STATE,
  type ReviewEmailReminderSettings,
} from "@/lib/reminders/contracts";
import type { SettingsCopy } from "@/lib/settings/presentation";

interface ReviewEmailReminderSettingsProps {
  reminder: ReviewEmailReminderSettings;
  copy: SettingsCopy["reminder"];
}

function scheduleCopy(timeZone: string, copy: SettingsCopy["reminder"]) {
  return `${copy.schedulePrefix} (${timeZone})${copy.scheduleSuffix}`;
}

export function ReviewEmailReminderSettings({
  reminder,
  copy,
}: ReviewEmailReminderSettingsProps) {
  const [state, formAction, pending] = useActionState(
    configureReviewEmailReminder,
    INITIAL_REVIEW_EMAIL_REMINDER_ACTION_STATE
  );
  const [hasConsent, setHasConsent] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const currentReminder =
    state.status === "success" ? state.reminder : reminder;
  const isEnabled = currentReminder.status === "enabled";

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state.status]);

  function submit(formData: FormData) {
    setHasConsent(false);
    formAction(formData);
  }

  return (
    <section
      aria-labelledby="review-email-reminder-heading"
      className={`rounded-xl border p-5 sm:p-6 ${
        isEnabled
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-stone-300 bg-white"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="review-email-reminder-heading"
              className="text-xl font-semibold tracking-[-0.025em] text-stone-950"
            >
              {copy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              {copy.description}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              isEnabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {isEnabled ? copy.enabled : copy.disabled}
          </span>
        </div>
        <p className="mt-4 border-t border-stone-200 pt-4 text-sm font-medium text-stone-700">
          {scheduleCopy(currentReminder.timeZone, copy)}
        </p>
      </div>

      {state.status === "error" ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
        >
          {copy.errors[state.code] ?? copy.errors.UPDATE_FAILED}
        </div>
      ) : null}

      {state.status === "success" ? (
        <p role="status" className="mt-5 text-sm font-medium text-emerald-800">
          {state.result === "enabled"
            ? copy.successEnabled
            : copy.successUnsubscribed}
        </p>
      ) : null}

      {isEnabled ? (
        <form action={submit} className="mt-6">
          <input type="hidden" name="intent" value="unsubscribe" />
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 cursor-pointer rounded-xl border border-stone-400 bg-white px-5 text-base font-semibold text-stone-900 transition-colors hover:border-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copy.unsubscribing : copy.unsubscribe}
          </button>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            {copy.unsubscribeHelp}
          </p>
        </form>
      ) : (
        <form action={submit} className="mt-6">
          <input type="hidden" name="intent" value="enable" />
          <label
            htmlFor="review-email-reminder-consent"
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-800 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100"
          >
            <input
              id="review-email-reminder-consent"
              name="reminder_consent"
              type="checkbox"
              checked={hasConsent}
              onChange={(event) => setHasConsent(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-orange-700"
            />
            <span>
              {copy.consent}
            </span>
          </label>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {scheduleCopy(currentReminder.timeZone, copy)}{" "}
            {copy.scheduleSettingsSuffix}
          </p>
          <button
            type="submit"
            disabled={!hasConsent || pending}
            className="mt-5 min-h-12 cursor-pointer rounded-xl bg-orange-700 px-5 text-base font-semibold text-white transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copy.enabling : copy.enable}
          </button>
        </form>
      )}
    </section>
  );
}
