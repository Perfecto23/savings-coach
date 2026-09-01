"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveSetupSavingsAccount } from "@/app/setup/actions";
import { FieldError } from "@/components/setup/field-error";
import {
  INITIAL_SETUP_FORM_STATE,
  type SetupSavingsCandidateDto,
} from "@/lib/setup/contracts";
import type { SetupFormErrorCode } from "@/lib/setup/contracts";
import type { SetupCopy } from "@/lib/setup/presentation";

type AccountMode = "attach" | "create";

interface SavingsAccountStepProps {
  candidates: SetupSavingsCandidateDto[];
  copy: SetupCopy["account"];
  errorCopy: Record<SetupFormErrorCode, string>;
}

export function SavingsAccountStep({
  candidates,
  copy,
  errorCopy,
}: SavingsAccountStepProps) {
  const [mode, setMode] = useState<AccountMode>(
    candidates.length > 0 ? "attach" : "create"
  );
  const [state, formAction, pending] = useActionState(
    saveSetupSavingsAccount,
    INITIAL_SETUP_FORM_STATE
  );
  const errorRef = useRef<HTMLDivElement>(null);
  const fieldError = state.status === "error" ? state.error : null;

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <div>
      <p className="text-sm font-medium text-orange-700">{copy.checkpoint}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-stone-950">
        {copy.title}
      </h2>
      <p className="mt-3 max-w-lg text-base leading-7 text-stone-600">
        {copy.description}
      </p>

      <form action={formAction} className="mt-8 space-y-6" noValidate>
        {state.status === "error" ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorCopy[state.error.code]}
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <fieldset
            aria-invalid={fieldError?.field === "mode"}
            aria-describedby={
              fieldError?.field === "mode" ? "setup-account-mode-error" : undefined
            }
          >
            <legend className="text-sm font-medium text-stone-800">
              {copy.choice}
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 transition-colors has-checked:border-orange-500 has-checked:bg-orange-50">
                <input
                  type="radio"
                  name="mode"
                  value="attach"
                  checked={mode === "attach"}
                  onChange={() => setMode("attach")}
                  className="h-4 w-4 accent-orange-600"
                />
                <span className="text-sm font-medium text-stone-800">
                  {copy.useExisting}
                </span>
              </label>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-stone-300 bg-white px-4 transition-colors has-checked:border-orange-500 has-checked:bg-orange-50">
                <input
                  type="radio"
                  name="mode"
                  value="create"
                  checked={mode === "create"}
                  onChange={() => setMode("create")}
                  className="h-4 w-4 accent-orange-600"
                />
                <span className="text-sm font-medium text-stone-800">
                  {copy.createNew}
                </span>
              </label>
            </div>
            <FieldError
              id="setup-account-mode-error"
              field="mode"
              error={fieldError}
              message={fieldError ? errorCopy[fieldError.code] : ""}
            />
          </fieldset>
        ) : (
          <input type="hidden" name="mode" value="create" />
        )}

        {mode === "attach" && candidates.length > 0 ? (
          <div>
            <label
              htmlFor="setup-savings-account"
              className="block text-sm font-medium text-stone-800"
            >
              {copy.savingsAccount}
            </label>
            <select
              id="setup-savings-account"
              name="savings_account_id"
              required
              defaultValue={candidates[0]?.id}
              aria-invalid={fieldError?.field === "savings_account_id"}
              aria-describedby={
                fieldError?.field === "savings_account_id"
                  ? "setup-account-existing-help setup-account-existing-error"
                  : "setup-account-existing-help"
              }
              className="mt-2 min-h-12 w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.institution ? ` — ${candidate.institution}` : ""}
                </option>
              ))}
            </select>
            <p id="setup-account-existing-help" className="mt-2 text-sm leading-6 text-stone-500">
              {copy.existingHelp}
            </p>
            <FieldError
              id="setup-account-existing-error"
              field="savings_account_id"
              error={fieldError}
              message={fieldError ? errorCopy[fieldError.code] : ""}
            />
          </div>
        ) : (
          <div className="grid gap-5">
            <div>
              <label
                htmlFor="setup-account-name"
                className="block text-sm font-medium text-stone-800"
              >
                {copy.accountName}
              </label>
              <input
                id="setup-account-name"
                name="name"
                type="text"
                required
                maxLength={100}
                autoComplete="off"
                placeholder={copy.accountPlaceholder}
                aria-invalid={fieldError?.field === "name"}
                aria-describedby={
                  fieldError?.field === "name" ? "setup-account-name-error" : undefined
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <FieldError
                id="setup-account-name-error"
                field="name"
                error={fieldError}
                message={fieldError ? errorCopy[fieldError.code] : ""}
              />
            </div>
            <div>
              <label
                htmlFor="setup-institution"
                className="block text-sm font-medium text-stone-800"
              >
                {copy.institution}
              </label>
              <input
                id="setup-institution"
                name="institution"
                type="text"
                maxLength={100}
                autoComplete="organization"
                placeholder={copy.institutionPlaceholder}
                aria-invalid={fieldError?.field === "institution"}
                aria-describedby={
                  fieldError?.field === "institution"
                    ? "setup-institution-error"
                    : undefined
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-sm placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <FieldError
                id="setup-institution-error"
                field="institution"
                error={fieldError}
                message={fieldError ? errorCopy[fieldError.code] : ""}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full cursor-pointer rounded-xl bg-orange-700 px-5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(194,65,12,0.24)] transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? copy.saving : copy.save}
        </button>
      </form>
    </div>
  );
}
