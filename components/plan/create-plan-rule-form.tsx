"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlanRule } from "@/app/(app)/plan/actions";
import { PlanFormErrorMessage } from "@/components/plan/plan-form-error";
import {
  INITIAL_PLAN_FORM_STATE,
  type PlanAccountDto,
} from "@/lib/plan/contracts";

export function CreatePlanRuleForm({
  ruleId,
  baseCurrency,
  sourceAccounts,
  targetAccount,
  onSaved,
}: {
  ruleId: string;
  baseCurrency: string;
  sourceAccounts: PlanAccountDto[];
  targetAccount: PlanAccountDto;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createPlanRule,
    INITIAL_PLAN_FORM_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const fieldError = state.status === "error" ? state.error : null;

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
    if (state.status === "success") {
      formRef.current?.reset();
      onSaved?.();
    }
  }, [onSaved, state]);

  return (
    <section aria-labelledby="add-plan-rule-heading">
      <h2
        id="add-plan-rule-heading"
        className="text-2xl font-semibold tracking-[-0.035em] text-stone-950"
      >
        Add a Plan Rule
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
        Choose one amount you intend to move each month. Savings Coach records
        the action; it never transfers money.
      </p>

      <form ref={formRef} action={formAction} className="mt-8 space-y-6">
        <input type="hidden" name="rule_id" value={ruleId} />

        {state.status === "error" ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {state.error.message}
          </div>
        ) : null}

        <div>
          <label htmlFor={`plan-rule-name-${ruleId}`} className="block text-sm font-medium text-stone-800">
            Rule name
          </label>
          <input
            id={`plan-rule-name-${ruleId}`}
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="Monthly savings transfer"
            aria-invalid={fieldError?.field === "name"}
            aria-describedby={fieldError?.field === "name" ? `plan-rule-name-error-${ruleId}` : undefined}
            className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base shadow-sm placeholder:text-stone-400 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <PlanFormErrorMessage
            id={`plan-rule-name-error-${ruleId}`}
            field="name"
            error={fieldError}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(128px,0.45fr)]">
          <div>
            <label htmlFor={`plan-rule-amount-${ruleId}`} className="block text-sm font-medium text-stone-800">
              Rule amount
            </label>
            <div className="relative mt-2">
              <input
                id={`plan-rule-amount-${ruleId}`}
                name="amount"
                type="text"
                inputMode="decimal"
                required
                placeholder="500.00"
                aria-invalid={fieldError?.field === "amount"}
                aria-describedby={`plan-rule-amount-help-${ruleId}${fieldError?.field === "amount" ? ` plan-rule-amount-error-${ruleId}` : ""}`}
                className="min-h-14 w-full rounded-xl border border-stone-300 bg-white px-4 pr-16 text-2xl font-semibold tabular-nums tracking-[-0.02em] shadow-sm placeholder:text-stone-300 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-stone-500">
                {baseCurrency}
              </span>
            </div>
            <p id={`plan-rule-amount-help-${ruleId}`} className="mt-2 text-sm leading-6 text-stone-500">
              A positive amount in your base currency.
            </p>
            <PlanFormErrorMessage
              id={`plan-rule-amount-error-${ruleId}`}
              field="amount"
              error={fieldError}
            />
          </div>

          <div>
            <label htmlFor={`plan-rule-due-${ruleId}`} className="block text-sm font-medium text-stone-800">
              Due day
            </label>
            <input
              id={`plan-rule-due-${ruleId}`}
              name="due_day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              required
              defaultValue={1}
              aria-invalid={fieldError?.field === "due_day"}
              aria-describedby={`plan-rule-due-help-${ruleId}${fieldError?.field === "due_day" ? ` plan-rule-due-error-${ruleId}` : ""}`}
              className="mt-2 min-h-14 w-full rounded-xl border border-stone-300 bg-white px-4 text-2xl font-semibold tabular-nums shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <p id={`plan-rule-due-help-${ruleId}`} className="mt-2 text-sm leading-6 text-stone-500">
              Short months use their last day.
            </p>
            <PlanFormErrorMessage
              id={`plan-rule-due-error-${ruleId}`}
              field="due_day"
              error={fieldError}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor={`plan-rule-source-${ruleId}`} className="block text-sm font-medium text-stone-800">
              Source account (optional)
            </label>
            <select
              id={`plan-rule-source-${ruleId}`}
              name="source_account_id"
              defaultValue=""
              aria-invalid={fieldError?.field === "source_account_id"}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">No Source Account</option>
              {sourceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <PlanFormErrorMessage
              id={`plan-rule-source-error-${ruleId}`}
              field="source_account_id"
              error={fieldError}
            />
          </div>

          <div>
            <label htmlFor={`plan-rule-target-${ruleId}`} className="block text-sm font-medium text-stone-800">
              Target account
            </label>
            <select
              id={`plan-rule-target-${ruleId}`}
              name="target_account_id"
              defaultValue={targetAccount.id}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 text-base text-stone-800 shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value={targetAccount.id}>{targetAccount.name}</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-orange-700 px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(194,65,12,0.24)] transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Adding…" : "Add rule"}
        </button>
      </form>
    </section>
  );
}
