import { randomUUID } from "node:crypto";
import { CreatePlanRuleForm } from "@/components/plan/create-plan-rule-form";
import { PlanActivationCard } from "@/components/plan/plan-activation-card";
import { PlanPath } from "@/components/plan/plan-path";
import { PlanRuleList } from "@/components/plan/plan-rule-list";
import { formatMoney } from "@/lib/format-money";
import { getSavingsPlanPage } from "@/lib/plan/server";

function formatActionDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default async function SavingsPlanPage() {
  const plan = await getSavingsPlanPage();
  const activeRuleCount = plan.rules.filter((rule) => rule.active).length;

  return (
    <div lang="en" className="mx-auto w-full max-w-6xl pb-10 text-stone-950">
      <header className="border-b border-stone-200 pb-8 pt-2 sm:pb-10 sm:pt-4">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          Build your Savings Plan
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
          Set a monthly intention, turn it into actions, and see the path ahead.
          No income data or bank connection required.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] lg:gap-10">
        <div className="min-w-0">
          {plan.rules.length === 0 ? (
            <section className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
              <CreatePlanRuleForm
                ruleId={randomUUID()}
                baseCurrency={plan.baseCurrency}
                sourceAccounts={plan.sourceAccounts}
                targetAccount={plan.targetAccount}
              />
            </section>
          ) : (
            <PlanRuleList
              rules={plan.rules}
              createRuleId={randomUUID()}
              locale={plan.locale}
              baseCurrency={plan.baseCurrency}
              sourceAccounts={plan.sourceAccounts}
              targetAccount={plan.targetAccount}
            />
          )}
        </div>

        <div className="min-w-0 lg:sticky lg:top-8">
          <PlanActivationCard
            isActivated={plan.isActivated}
            activeRuleCount={activeRuleCount}
            monthlyPlannedAmount={plan.monthlyPlannedAmount}
            locale={plan.locale}
            baseCurrency={plan.baseCurrency}
            targetAccount={plan.targetAccount}
            nextAction={plan.nextAction}
          />
        </div>
      </div>

      <section aria-label="Current month actions" className="mt-12 sm:mt-16">
        <h2 className="text-2xl font-semibold tracking-[-0.035em] text-stone-950">
          Current month actions
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Each action keeps the Rule Amount and account names from the month it
          was created.
        </p>

        {plan.currentActions.length === 0 ? (
          <div className="mt-6 border-y border-stone-200 py-8 text-sm leading-6 text-stone-500">
            Activate your Savings Plan to create this month&apos;s actions.
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
            {plan.currentActions.map((action) => (
              <li key={action.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-stone-950">{action.name}</h3>
                    {action.overdue ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                        Overdue
                      </span>
                    ) : null}
                    {action.completed ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        Completed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Due {formatActionDate(action.scheduledFor, plan.locale)} · {action.sourceAccountName ?? "No Source Account"} → {action.targetAccountName}
                  </p>
                </div>
                <p className="shrink-0 text-xl font-semibold tabular-nums tracking-[-0.02em] text-stone-950">
                  {formatMoney(Number(action.amount), plan.locale, plan.baseCurrency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PlanPath
        points={plan.path}
        locale={plan.locale}
        baseCurrency={plan.baseCurrency}
      />
    </div>
  );
}
