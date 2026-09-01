import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OwnerSetupRow } from "@/lib/types/database";
import type {
  SetupBalanceDto,
  SetupBaseCurrency,
  SetupLocale,
  SetupSavingsAccountDto,
  SetupSavingsCandidateDto,
  SetupState,
} from "./contracts";
import { APP_LOCALE } from "@/lib/product-locale";

interface AccountProjection {
  id: string;
  name: string;
  bank: string | null;
  purpose: "savings";
  sort_order: number;
}

interface SnapshotProjection {
  account_id: string;
  balance: number | string;
  recorded_at: string;
  created_at: string;
}

function toAccountDto(account: AccountProjection): SetupSavingsAccountDto {
  return {
    id: account.id,
    name: account.name,
    institution: account.bank,
    purpose: "savings",
  };
}

function toBalanceDto(snapshot: SnapshotProjection): SetupBalanceDto {
  return {
    balance: String(snapshot.balance),
    recordedAt: snapshot.recorded_at,
  };
}

export async function getSetupState(): Promise<SetupState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [setupResult, accountsResult] = await Promise.all([
    supabase
      .from("owner_setup")
      .select("locale, time_zone, base_currency, savings_account_id, created_at, updated_at")
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("id, name, bank, purpose, sort_order")
      .eq("owner_id", user.id)
      .eq("purpose", "savings")
      .order("sort_order"),
  ]);

  if (setupResult.error || accountsResult.error) {
    throw new Error("Unable to load Setup checkpoint");
  }

  const setup = setupResult.data as Omit<OwnerSetupRow, "owner_id"> | null;
  const accounts = (accountsResult.data || []) as AccountProjection[];
  const accountIds = accounts.map((account) => account.id);

  let snapshots: SnapshotProjection[] = [];
  if (accountIds.length > 0) {
    const snapshotsResult = await supabase
      .from("balance_snapshots")
      .select("account_id, balance, recorded_at, created_at")
      .in("account_id", accountIds)
      .order("recorded_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (snapshotsResult.error) {
      throw new Error("Unable to load Setup checkpoint");
    }
    snapshots = (snapshotsResult.data || []) as SnapshotProjection[];
  }

  const latestByAccount = new Map<string, SnapshotProjection>();
  for (const snapshot of snapshots) {
    if (!latestByAccount.has(snapshot.account_id)) {
      latestByAccount.set(snapshot.account_id, snapshot);
    }
  }

  const candidateSavingsAccounts: SetupSavingsCandidateDto[] = accounts.map((account) => {
    const latest = latestByAccount.get(account.id);
    return {
      ...toAccountDto(account),
      latestBalance: latest ? toBalanceDto(latest) : null,
    };
  });

  if (!setup) {
    return {
      step: "preferences",
      isComplete: false,
      preferences: null,
      savingsAccount: null,
      initialBalance: null,
      candidateSavingsAccounts,
    };
  }

  const preferences = {
    locale: APP_LOCALE as SetupLocale,
    timeZone: setup.time_zone,
    baseCurrency: setup.base_currency as SetupBaseCurrency,
  };
  const linkedAccount = accounts.find((account) => account.id === setup.savings_account_id);

  if (!linkedAccount) {
    return {
      step: "savingsAccount",
      isComplete: false,
      preferences,
      savingsAccount: null,
      initialBalance: null,
      candidateSavingsAccounts,
    };
  }

  const savingsAccount = toAccountDto(linkedAccount);
  const latestSnapshot = latestByAccount.get(linkedAccount.id);

  if (!latestSnapshot) {
    return {
      step: "initialBalance",
      isComplete: false,
      preferences,
      savingsAccount,
      initialBalance: null,
      candidateSavingsAccounts,
    };
  }

  return {
    step: "complete",
    isComplete: true,
    preferences,
    savingsAccount,
    initialBalance: toBalanceDto(latestSnapshot),
    candidateSavingsAccounts,
  };
}
