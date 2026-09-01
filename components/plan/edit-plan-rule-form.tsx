"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePlanRule } from "@/app/(app)/plan/actions";
import { PlanFormErrorMessage } from "@/components/plan/plan-form-error";
import {
  INITIAL_PLAN_FORM_STATE,
  type PlanAccountDto,
  type PlanRuleDto,
} from "@/lib/plan/contracts";
import type { PlanCopy } from "@/lib/plan/presentation";

export function EditPlanRuleForm({
  rule,
  baseCurrency,
  sourceAccounts,
  targetAccount,
  copy,
  onCancel,
  onSaved,
}: {
  rule: PlanRuleDto;
  baseCurrency: string;
  sourceAccounts: PlanAccountDto[];
  targetAccount: PlanAccountDto;
  copy: PlanCopy;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updatePlanRule,
    INITIAL_PLAN_FORM_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const fieldError = state.status === "error" ? state.error : null;
  const errorMessage = fieldError ? copy.errorMessages[fieldError.code] : null;

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
    if (state.status === "success") onSaved();
  }, [onSaved, state]);

  return (
    <section aria-labelledby={`edit-plan-rule-${rule.id}`} className="mt-5 border-t border-stone-200 pt-5">
      <h3 id={`edit-plan-rule-${rule.id}`} className="text-lg font-semibold tracking-[-0.02em] text-stone-950">
        {copy.editForm.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        {copy.editForm.description}
      </p>

      <form action={formAction} className="mt-5 space-y-5" noValidate>
        <input type="hidden" name="rule_id" value={rule.id} />

        {state.status === "error" ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        ) : null}

        <div>
          <label htmlFor={`edit-rule-name-${rule.id}`} className="block text-sm font-medium text-stone-800">
            {copy.editForm.nameLabel}
          </label>
          <input
            id={`edit-rule-name-${rule.id}`}
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={rule.name}
            aria-invalid={fieldError?.field === "name"}
            className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <PlanFormErrorMessage id={`edit-rule-name-error-${rule.id}`} message={fieldError?.field === "name" ? errorMessage : null} />
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_128px]">
          <div>
            <label htmlFor={`edit-rule-amount-${rule.id}`} className="block text-sm font-medium text-stone-800">
              {copy.editForm.amountLabel}
            </label>
            <div className="relative mt-2">
              <input
                id={`edit-rule-amount-${rule.id}`}
                name="amount"
                type="text"
                inputMode="decimal"
                required
                defaultValue={rule.amount}
                aria-invalid={fieldError?.field === "amount"}
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 pr-16 text-lg font-semibold tabular-nums shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-stone-500">
                {baseCurrency}
              </span>
            </div>
            <PlanFormErrorMessage id={`edit-rule-amount-error-${rule.id}`} message={fieldError?.field === "amount" ? errorMessage : null} />
          </div>

          <div>
            <label htmlFor={`edit-rule-due-${rule.id}`} className="block text-sm font-medium text-stone-800">
              {copy.editForm.dueDayLabel}
            </label>
            <input
              id={`edit-rule-due-${rule.id}`}
              name="due_day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              required
              defaultValue={rule.dueDay}
              aria-invalid={fieldError?.field === "due_day"}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg font-semibold tabular-nums shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <PlanFormErrorMessage id={`edit-rule-due-error-${rule.id}`} message={fieldError?.field === "due_day" ? errorMessage : null} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`edit-rule-source-${rule.id}`} className="block text-sm font-medium text-stone-800">
              {copy.editForm.sourceAccountLabel}
            </label>
            <select
              id={`edit-rule-source-${rule.id}`}
              name="source_account_id"
              defaultValue={rule.sourceAccount?.id ?? ""}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="">{copy.editForm.noSourceAccount}</option>
              {sourceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`edit-rule-target-${rule.id}`} className="block text-sm font-medium text-stone-800">
              {copy.editForm.targetAccountLabel}
            </label>
            <select
              id={`edit-rule-target-${rule.id}`}
              name="target_account_id"
              defaultValue={targetAccount.id}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 text-base text-stone-800 shadow-sm focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value={targetAccount.id}>{targetAccount.name}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
          >
            {copy.editForm.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-xl bg-stone-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? copy.editForm.submitting : copy.editForm.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
