import { redirect } from "next/navigation";
import { InitialBalanceStep } from "@/components/setup/initial-balance-step";
import { PreferencesStep } from "@/components/setup/preferences-step";
import { SavingsAccountStep } from "@/components/setup/savings-account-step";
import { SetupShell } from "@/components/setup/setup-shell";
import { formatMoney } from "@/lib/format-money";
import { getSetupState } from "@/lib/setup/server";

interface SetupPageProps {
  searchParams: Promise<{ advanced?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const [state, params] = await Promise.all([getSetupState(), searchParams]);

  if (state.step === "complete") {
    redirect(params.advanced === "account" ? "/setup/complete" : "/");
  }

  return (
    <SetupShell
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
          legacyCurrencyLocked={state.candidateSavingsAccounts.some(
            (account) => account.latestBalance !== null
          )}
        />
      ) : null}

      {state.step === "savingsAccount" ? (
        <SavingsAccountStep candidates={state.candidateSavingsAccounts} />
      ) : null}

      {state.step === "initialBalance" ? (
        <InitialBalanceStep
          preferences={state.preferences}
          account={state.savingsAccount}
        />
      ) : null}
    </SetupShell>
  );
}
