"use client";

import { useCallback, useState, useTransition } from "react";
import { setPlanRuleActive } from "@/app/(app)/plan/actions";
import { CreatePlanRuleForm } from "@/components/plan/create-plan-rule-form";
import { EditPlanRuleForm } from "@/components/plan/edit-plan-rule-form";
import { formatMoney } from "@/lib/format-money";
import type {
  PlanAccountDto,
  PlanRuleDto,
} from "@/lib/plan/contracts";
import type { PlanCopy } from "@/lib/plan/presentation";

export function PlanRuleList({
  rules,
  createRuleId,
  locale,
  baseCurrency,
  sourceAccounts,
  targetAccount,
  copy,
}: {
  rules: PlanRuleDto[];
  createRuleId: string;
  locale: string;
  baseCurrency: string;
  sourceAccounts: PlanAccountDto[];
  targetAccount: PlanAccountDto;
  copy: PlanCopy;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const closeEditor = useCallback(() => setEditingId(null), []);
  const closeCreate = useCallback(() => setAdding(false), []);

  function changeActive(rule: PlanRuleDto) {
    setActionError(null);
    startTransition(async () => {
      const result = await setPlanRuleActive(rule.id, !rule.active);
      if (result.status === "error") {
        setActionError(copy.errorMessages[result.error.code]);
      }
    });
  }

  return (
    <section aria-label={copy.ruleList.regionLabel}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-stone-950">
            {copy.ruleList.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            {copy.ruleList.description}
          </p>
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
            className="min-h-11 cursor-pointer rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-950"
          >
            {copy.ruleList.addAnother}
          </button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      {adding ? (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <CreatePlanRuleForm
            ruleId={createRuleId}
            baseCurrency={baseCurrency}
            sourceAccounts={sourceAccounts}
            targetAccount={targetAccount}
            copy={copy}
            onSaved={closeCreate}
          />
          <button
            type="button"
            onClick={closeCreate}
            className="mt-4 min-h-11 cursor-pointer rounded-xl px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
          >
            {copy.ruleList.cancel}
          </button>
        </div>
      ) : null}

      <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
        {rules.map((rule) => (
          <li key={rule.id} className="py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-stone-950">
                    {rule.name}
                  </h3>
                  {rule.active ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                      {copy.ruleList.active}
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700">
                      {copy.ruleList.inactive}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  <span className="font-semibold tabular-nums text-stone-950">
                    {formatMoney(Number(rule.amount), locale, baseCurrency)}
                  </span>{" "}
                  {copy.ruleList.onDayPrefix} {rule.dueDay}{copy.ruleList.dueDaySuffix} · {rule.sourceAccount?.name ?? copy.page.noSourceAccount} → {rule.targetAccount.name}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setEditingId(editingId === rule.id ? null : rule.id);
                  }}
                  className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
                >
                  {copy.ruleList.edit}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => changeActive(rule)}
                  className="min-h-11 cursor-pointer rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rule.active ? copy.ruleList.deactivate : copy.ruleList.reactivate}
                </button>
              </div>
            </div>

            {editingId === rule.id ? (
              <EditPlanRuleForm
                rule={rule}
                baseCurrency={baseCurrency}
                sourceAccounts={sourceAccounts}
                targetAccount={targetAccount}
                copy={copy}
                onCancel={closeEditor}
                onSaved={closeEditor}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
