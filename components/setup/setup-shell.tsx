import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import type { SetupCopy } from "@/lib/setup/presentation";
import { APP_LOCALE } from "@/lib/product-locale";

export type SetupStepId =
  | "preferences"
  | "savingsAccount"
  | "initialBalance";

interface SetupShellProps {
  copy: SetupCopy["shell"];
  currentStep: SetupStepId;
  summary?: {
    region?: string;
    account?: string;
    balance?: string;
  };
  children: ReactNode;
}

export function SetupShell({
  copy,
  currentStep,
  summary,
  children,
}: SetupShellProps) {
  const steps = (["preferences", "savingsAccount", "initialBalance"] as const).map(
    (id) => ({ id, ...copy.steps[id] })
  );
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <main
      lang={APP_LOCALE}
      className="min-h-dvh bg-[#f6f1e8] text-stone-950 selection:bg-orange-200 selection:text-orange-950"
    >
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[minmax(320px,0.8fr)_minmax(560px,1.2fr)]">
        <aside className="relative overflow-hidden bg-stone-950 px-6 py-5 text-stone-50 sm:px-10 sm:py-7 lg:flex lg:min-h-dvh lg:flex-col lg:px-12 lg:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-28 h-72 w-72 rounded-full border border-orange-400/20"
          />
          <div
            aria-hidden="true"
            className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-orange-500/10"
          />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-orange-950">
                <SavingsMark className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold tracking-[-0.01em]">
                {copy.brand}
              </span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="min-h-11 cursor-pointer rounded-full px-3 text-sm text-stone-300 transition-colors hover:text-white"
              >
                {copy.signOut}
              </button>
            </form>
          </div>

          <div className="relative mt-5 max-w-md sm:mt-10 lg:mt-24">
            <h1 className="max-w-sm text-2xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl lg:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-300 sm:mt-4 sm:text-base sm:leading-7">
              {copy.description}
            </p>
          </div>

          <ol className="relative mt-5 grid gap-2 sm:mt-8 sm:grid-cols-3 sm:gap-3 lg:mt-14 lg:grid-cols-1 lg:gap-6">
            {steps.map((step, index) => {
              const isCurrent = step.id === currentStep;
              const isComplete = index < currentIndex;

              return (
                <li
                  key={step.id}
                  aria-current={isCurrent ? "step" : undefined}
                  className="group flex min-w-0 items-start gap-3"
                >
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors ${
                      isCurrent
                        ? "border-orange-400 bg-orange-400 text-orange-950"
                        : isComplete
                          ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                          : "border-stone-600 text-stone-400"
                    }`}
                  >
                    {isComplete ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium ${
                        isCurrent || isComplete
                          ? "text-white"
                          : "text-stone-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="mt-1 hidden text-xs leading-5 text-stone-500 lg:block">
                      {step.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          {summary ? (
            <dl className="relative mt-10 hidden max-w-sm grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t border-stone-800 pt-5 text-sm lg:grid">
              {summary.region ? (
                <>
                  <dt className="text-stone-500">{copy.region}</dt>
                  <dd className="truncate text-right text-stone-300">
                    {summary.region}
                  </dd>
                </>
              ) : null}
              {summary.account ? (
                <>
                  <dt className="text-stone-500">{copy.savingsAccount}</dt>
                  <dd className="truncate text-right text-stone-300">
                    {summary.account}
                  </dd>
                </>
              ) : null}
              {summary.balance ? (
                <>
                  <dt className="text-stone-500">{copy.startingBalance}</dt>
                  <dd className="truncate text-right font-medium text-stone-100">
                    {summary.balance}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}

          <p className="relative mt-10 hidden text-xs leading-5 text-stone-500 lg:mt-auto lg:block lg:max-w-xs">
            {copy.privacy}
          </p>
        </aside>

        <section className="flex min-h-[58vh] items-start px-5 py-8 sm:px-10 sm:py-12 lg:min-h-dvh lg:items-center lg:px-16 lg:py-20">
          <div className="mx-auto w-full max-w-xl">{children}</div>
        </section>
      </div>
    </main>
  );
}

function SavingsMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 9.5c0-3 2.7-5.5 6.5-5.5h1c3.8 0 6.5 2.5 6.5 5.5v3.25c0 3.45-2.8 6.25-6.25 6.25h-1.5A6.25 6.25 0 0 1 5 12.75V9.5Z" />
      <path d="M8.5 9.25h.01M15.5 9.25h.01M9 18.5V21m6-2.5V21M19 11h2v3h-2" />
      <path d="M9.5 5.2c.7-.8 1.55-1.2 2.5-1.2.95 0 1.8.4 2.5 1.2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 10 3 3 7-7" />
    </svg>
  );
}
