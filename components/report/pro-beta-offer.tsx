"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { recordPaidIntent } from "@/app/(app)/milestones/[yearMonth]/report/paid-intent-actions";
import { INITIAL_PAID_INTENT_ACTION_STATE } from "@/lib/paid-intent/contracts";

interface ProBetaOfferProps {
  eligible: boolean;
  recorded: boolean;
}

export function ProBetaOffer({ eligible, recorded }: ProBetaOfferProps) {
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
        aria-label="Pro beta interest"
        className="rounded-xl border border-violet-200 bg-violet-50 p-5 text-violet-950 sm:p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-700">
          Interest recorded
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          You were not charged, and no subscription was created.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-900/80">
          This is a product-interest signal only. It does not unlock Pro or
          reserve a future price.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Savings Coach Pro beta offer"
      className="rounded-xl border border-violet-200 bg-white p-5 sm:p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-700">
        Pro beta interest
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
        Help shape Savings Coach Pro
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
        We are exploring scheduled reminders and richer Monthly Review guidance.
        Planned features are not available or guaranteed yet.
      </p>

      <div className="mt-5 rounded-xl bg-violet-50 px-4 py-4">
        <p className="text-2xl font-semibold tracking-[-0.025em] text-violet-950">
          US$4.99/month after launch
        </p>
        <p className="mt-2 text-sm leading-6 text-violet-900">
          Today: no charge. No card. No subscription. This records interest
          only; it does not start a trial or reserve a price.
        </p>
      </div>

      {state.status === "error" ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error.message}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 cursor-pointer rounded-xl bg-violet-700 px-5 text-base font-semibold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Recording…" : "I'm interested in Pro beta"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-950"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
