"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  SUPPORTED_BASE_CURRENCIES,
  SUPPORTED_SETUP_LOCALES,
  type SetupBaseCurrency,
  type SetupFormError,
  type SetupFormErrorCode,
  type SetupFormState,
  type SetupLocale,
} from "@/lib/setup/contracts";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RPC_ERRORS: Record<string, { code: SetupFormErrorCode; field?: string; message: string }> = {
  unauthenticated: { code: "UNAUTHENTICATED", message: "Please sign in again." },
  invalid_locale: { code: "INVALID_LOCALE", field: "locale", message: "Choose a supported language." },
  invalid_time_zone: { code: "INVALID_TIME_ZONE", field: "time_zone", message: "Choose a valid time zone." },
  unsupported_base_currency: { code: "INVALID_BASE_CURRENCY", field: "base_currency", message: "Choose a supported base currency." },
  base_currency_locked: { code: "BASE_CURRENCY_LOCKED", field: "base_currency", message: "Base currency cannot change after a balance is recorded." },
  preferences_required: { code: "PREFERENCES_REQUIRED", message: "Save your preferences first." },
  invalid_account_mode: { code: "INVALID_ACCOUNT_MODE", field: "mode", message: "Choose whether to create or attach an account." },
  invalid_account_name: { code: "INVALID_ACCOUNT_NAME", field: "name", message: "Enter an account name of 100 characters or fewer." },
  invalid_institution: { code: "INVALID_INSTITUTION", field: "institution", message: "Institution must be 100 characters or fewer." },
  account_not_found: { code: "ACCOUNT_NOT_FOUND", field: "savings_account_id", message: "Savings account was not found." },
  account_not_savings: { code: "ACCOUNT_NOT_SAVINGS", field: "savings_account_id", message: "Choose a savings account." },
  savings_account_required: { code: "SAVINGS_ACCOUNT_REQUIRED", message: "Save a savings account first." },
  invalid_balance: { code: "INVALID_BALANCE", field: "balance", message: "Enter a non-negative balance with at most two decimal places." },
  invalid_recorded_at: { code: "INVALID_RECORDED_AT", field: "recorded_at", message: "Choose a valid date that is not in the future." },
  initial_balance_conflict: { code: "INITIAL_BALANCE_CONFLICT", field: "balance", message: "A different balance already exists for this date." },
};

function errorState(error: SetupFormError): SetupFormState {
  return { status: "error", error };
}

function unauthenticatedState(): SetupFormState {
  return errorState({ code: "UNAUTHENTICATED", message: "Please sign in again." });
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isSupportedLocale(value: string): value is SetupLocale {
  return (SUPPORTED_SETUP_LOCALES as readonly string[]).includes(value);
}

function isSupportedCurrency(value: string): value is SetupBaseCurrency {
  return (SUPPORTED_BASE_CURRENCIES as readonly string[]).includes(value);
}

function normalizeTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapRpcError(error: { code?: string; message?: string }): SetupFormState {
  if (error.code === "P0001" && error.message) {
    const stableError = RPC_ERRORS[error.message];
    if (stableError) return errorState(stableError);
  }
  return errorState({ code: "SETUP_SAVE_FAILED", message: "Setup could not be saved. Try again." });
}

async function callSetupRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  step: "preferences" | "savings_account" | "initial_balance",
  payload: Record<string, unknown>
): Promise<SetupFormState | null> {
  const { error } = await supabase.rpc("save_owner_setup_step", {
    p_step: step,
    p_payload: payload,
  });
  return error ? mapRpcError(error) : null;
}

export async function saveSetupPreferences(
  _previousState: SetupFormState,
  formData: FormData
): Promise<SetupFormState> {
  void _previousState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthenticatedState();

  const localeInput = readString(formData, "locale");
  let locale: string;
  try {
    locale = new Intl.Locale(localeInput).toString();
  } catch {
    return errorState({ code: "INVALID_LOCALE", field: "locale", message: "Choose a supported language." });
  }
  if (!isSupportedLocale(locale)) {
    return errorState({ code: "INVALID_LOCALE", field: "locale", message: "Choose a supported language." });
  }

  const timeZone = normalizeTimeZone(readString(formData, "time_zone"));
  if (!timeZone) {
    return errorState({ code: "INVALID_TIME_ZONE", field: "time_zone", message: "Choose a valid time zone." });
  }

  const currency = readString(formData, "base_currency").toUpperCase();
  if (!isSupportedCurrency(currency)) {
    return errorState({ code: "INVALID_BASE_CURRENCY", field: "base_currency", message: "Choose a supported base currency." });
  }

  const failure = await callSetupRpc(supabase, "preferences", {
    locale,
    time_zone: timeZone,
    base_currency: currency,
  });
  if (failure) return failure;

  revalidatePath("/setup");
  redirect("/setup");
}

export async function saveSetupSavingsAccount(
  _previousState: SetupFormState,
  formData: FormData
): Promise<SetupFormState> {
  void _previousState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthenticatedState();

  const mode = readString(formData, "mode");
  let payload: Record<string, unknown>;

  if (mode === "create") {
    const name = readString(formData, "name");
    if (!name || name.length > 100) {
      return errorState({ code: "INVALID_ACCOUNT_NAME", field: "name", message: "Enter an account name of 100 characters or fewer." });
    }

    const institutionValue = formData.get("institution");
    const institution =
      typeof institutionValue === "string"
        ? institutionValue.trim() || null
        : null;
    if (institution && institution.length > 100) {
      return errorState({ code: "INVALID_INSTITUTION", field: "institution", message: "Institution must be 100 characters or fewer." });
    }

    payload = { mode, name, institution };
  } else if (mode === "attach") {
    const accountId = readString(formData, "savings_account_id");
    if (!UUID_PATTERN.test(accountId)) {
      return errorState({ code: "ACCOUNT_NOT_FOUND", field: "savings_account_id", message: "Savings account was not found." });
    }
    payload = { mode, savings_account_id: accountId };
  } else {
    return errorState({ code: "INVALID_ACCOUNT_MODE", field: "mode", message: "Choose whether to create or attach an account." });
  }

  const failure = await callSetupRpc(supabase, "savings_account", payload);
  if (failure) return failure;

  revalidatePath("/setup");
  revalidatePath("/balances");
  redirect("/setup?advanced=account");
}

export async function saveSetupInitialBalance(
  _previousState: SetupFormState,
  formData: FormData
): Promise<SetupFormState> {
  void _previousState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthenticatedState();

  const balance = readString(formData, "balance");
  if (!MONEY_PATTERN.test(balance)) {
    return errorState({ code: "INVALID_BALANCE", field: "balance", message: "Enter a non-negative balance with at most two decimal places." });
  }

  const recordedAt = readString(formData, "recorded_at");
  if (!isCalendarDate(recordedAt)) {
    return errorState({ code: "INVALID_RECORDED_AT", field: "recorded_at", message: "Choose a valid date that is not in the future." });
  }

  const failure = await callSetupRpc(supabase, "initial_balance", {
    balance,
    recorded_at: recordedAt,
  });
  if (failure) return failure;

  revalidatePath("/setup");
  revalidatePath("/balances");
  revalidatePath("/");
  redirect("/setup/complete");
}
