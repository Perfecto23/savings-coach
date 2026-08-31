import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { InitialBalanceStep } from "@/components/setup/initial-balance-step";
import { PreferencesStep } from "@/components/setup/preferences-step";
import { SavingsAccountStep } from "@/components/setup/savings-account-step";
import { SetupShell } from "@/components/setup/setup-shell";
import { formatMoney } from "@/lib/format-money";
import { getSetupState } from "@/lib/setup/server";
import { getSetupCopy } from "@/lib/setup/presentation";
import type { SetupLocale } from "@/lib/setup/contracts";

interface SetupPageProps {
  searchParams: Promise<{ advanced?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const [state, params, requestHeaders] = await Promise.all([
    getSetupState(),
    searchParams,
    headers(),
  ]);

  if (state.step === "complete") {
    redirect(params.advanced === "account" ? "/setup/complete" : "/");
  }

  const locale: SetupLocale =
    state.preferences?.locale ??
    (requestHeaders.get("accept-language")?.toLowerCase().includes("zh")
      ? "zh-CN"
      : "en-US");
  const copy = getSetupCopy(locale);

  return (
    <SetupShell
      locale={locale}
      copy={copy.shell}
      currentStep={state.step}
      summary={
        state.step === "preferences"
          ? undefined
          : {
              region: `${state.preferences.locale} · ${state.preferences.baseCurrency}`,
              account:
                state.step === "initialBalance"
                  ? state.savingsAccount.name
                  : undefined,
              balance:
                state.step === "initialBalance"
                  ? formatMoney(
                      0,
                      state.preferences.locale,
                      state.preferences.baseCurrency
                    ).replace(/[\d,.\s]+$/, "—")
                  : undefined,
            }
      }
    >
      {state.step === "preferences" ? (
        <PreferencesStep
          locale={locale}
          copy={copy.preferences}
          errorCopy={copy.errors}
          legacyCurrencyLocked={state.candidateSavingsAccounts.some(
            (account) => account.latestBalance !== null
          )}
        />
      ) : null}

      {state.step === "savingsAccount" ? (
        <SavingsAccountStep
          candidates={state.candidateSavingsAccounts}
          copy={copy.account}
          errorCopy={copy.errors}
        />
      ) : null}

      {state.step === "initialBalance" ? (
        <InitialBalanceStep
          preferences={state.preferences}
          account={state.savingsAccount}
          copy={copy.balance}
          errorCopy={copy.errors}
        />
      ) : null}
    </SetupShell>
  );
}
