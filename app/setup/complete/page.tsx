import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { formatMoney } from "@/lib/format-money";
import { getSetupState } from "@/lib/setup/server";
import { getSetupCopy } from "@/lib/setup/presentation";
import { DocumentLocale } from "@/components/document-locale";

function formatCalendarDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default async function SetupCompletePage() {
  const state = await getSetupState();
  if (state.step !== "complete") redirect("/setup");

  const amount = formatMoney(
    Number(state.initialBalance.balance),
    state.preferences.locale,
    state.preferences.baseCurrency
  );
  const copy = getSetupCopy(state.preferences.locale).complete;

  return (
    <main
      lang={state.preferences.locale}
      className="min-h-dvh bg-stone-950 px-5 py-8 text-stone-50 selection:bg-orange-200 selection:text-orange-950 sm:px-8"
    >
      <DocumentLocale locale={state.preferences.locale} />
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-500 text-orange-950">
              <CheckIcon className="h-5 w-5" />
            </span>
            {copy.brand}
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="min-h-11 cursor-pointer rounded-full px-3 text-sm text-stone-300 transition-colors hover:text-white"
            >
              {copy.signOut}
            </button>
          </form>
        </header>

        <section className="my-auto py-16">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.045em] text-balance sm:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-8 max-w-3xl text-2xl leading-tight tracking-[-0.025em] text-stone-300 sm:text-4xl">
            {copy.amountBefore}{" "}
            <strong className="font-semibold text-white">{amount}</strong>{" "}
            {copy.amountBetween}{" "}
            <strong className="font-semibold text-white">
              {state.savingsAccount.name}
            </strong>
            {copy.amountAfter}
          </p>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-stone-800 pt-6 text-sm text-stone-400">
            <span>
              {formatCalendarDate(
                state.initialBalance.recordedAt,
                state.preferences.locale
              )}
            </span>
            <span>{state.preferences.timeZone}</span>
            <span>{state.preferences.baseCurrency}</span>
          </div>

          <Link
            href="/"
            className="mt-12 inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-6 text-base font-semibold text-orange-950 shadow-[0_12px_32px_rgba(249,115,22,0.22)] transition-colors hover:bg-orange-400"
          >
            {copy.continue}
          </Link>
        </section>

        <p className="pb-2 text-xs leading-5 text-stone-400">
          {copy.boundary}
        </p>
      </div>
    </main>
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
