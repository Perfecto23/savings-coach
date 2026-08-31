"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { recordPaidIntent } from "@/app/(app)/milestones/[yearMonth]/report/paid-intent-actions";
import { INITIAL_PAID_INTENT_ACTION_STATE } from "@/lib/paid-intent/contracts";
import type { PaidIntentCopy } from "@/lib/paid-intent/presentation";

interface ProBetaOfferProps {
  eligible: boolean;
  recorded: boolean;
  copy: PaidIntentCopy;
}

export function ProBetaOffer({ eligible, recorded, copy }: ProBetaOfferProps) {
  const [state, formAction, pending] = useActionState(
    recordPaidIntent,
    INITIAL_PAID_INTENT_ACTION_STATE
  );
  const [dismissed, setDismissed] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  if (!eligible || dismissed) return null;

  if (recorded || state.status === "success") {
    return (
      <section
        aria-label={copy.recorded.ariaLabel}
        className="rounded-xl border border-violet-200 bg-violet-50 p-5 text-violet-950 sm:p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-700">
          {copy.recorded.label}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          {copy.recorded.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-900/80">
          {copy.recorded.description}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label={copy.offer.ariaLabel}
      className="rounded-xl border border-violet-200 bg-white p-5 sm:p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-700">
        {copy.offer.label}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
        {copy.offer.title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
        {copy.offer.description}
      </p>

      <div className="mt-5 rounded-xl bg-stone-100 px-4 py-4">
        <p className="text-2xl font-semibold tracking-[-0.025em] text-stone-950">
          {copy.offer.price}
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          {copy.offer.disclaimer}
        </p>
      </div>

      {state.status === "error" ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {copy.errors[state.error.code]}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 cursor-pointer rounded-xl bg-violet-700 px-5 text-base font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copy.offer.recording : copy.offer.record}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-950"
        >
          {copy.offer.dismiss}
        </button>
      </div>
    </section>
  );
}
