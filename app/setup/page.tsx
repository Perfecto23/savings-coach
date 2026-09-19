import { redirect } from "next/navigation";
import { InitialBalanceStep } from "@/components/setup/initial-balance-step";
import { PreferencesStep } from "@/components/setup/preferences-step";
import { SavingsAccountStep } from "@/components/setup/savings-account-step";
import { SetupShell } from "@/components/setup/setup-shell";
import { getSetupState } from "@/lib/setup/server";
import { getSetupCopy } from "@/lib/setup/presentation";

interface SetupPageProps {
  searchParams: Promise<{ advanced?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const [state, params] = await Promise.all([
    getSetupState(),
    searchParams,
  ]);

  if (state.step === "complete") {
    redirect(params.advanced === "account" ? "/setup/complete" : "/");
  }

  const copy = getSetupCopy();

  return (
    <SetupShell
      copy={copy.shell}
      currentStep={state.step}
      summary={
        state.step === "preferences"
          ? undefined
          : {
              region: `${state.preferences.timeZone} · ${state.preferences.baseCurrency}`,
              account:
                state.step === "initialBalance"
                  ? state.savingsAccount.name
                  : undefined,
              balance:
                state.step === "initialBalance"
                  ? "待记录"
                  : undefined,
            }
      }
    >
      {state.step === "preferences" ? (
        <PreferencesStep
          copy={copy.preferences}
          errorCopy={copy.errors}
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
