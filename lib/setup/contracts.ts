export const SUPPORTED_SETUP_LOCALES = ["zh-CN"] as const;

export const SUPPORTED_BASE_CURRENCIES = [
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "EUR",
  "GBP",
  "HKD",
  "NZD",
  "SGD",
  "USD",
] as const;

export type SetupLocale = (typeof SUPPORTED_SETUP_LOCALES)[number];
export type SetupBaseCurrency = (typeof SUPPORTED_BASE_CURRENCIES)[number];
export type SetupStep = "preferences" | "savingsAccount" | "initialBalance" | "complete";

export interface SetupPreferencesDto {
  locale: SetupLocale;
  timeZone: string;
  baseCurrency: SetupBaseCurrency;
}

export interface SetupSavingsAccountDto {
  id: string;
  name: string;
  institution: string | null;
  purpose: "savings";
}

export interface SetupBalanceDto {
  balance: string;
  recordedAt: string;
}

export interface SetupSavingsCandidateDto extends SetupSavingsAccountDto {
  latestBalance: SetupBalanceDto | null;
}

interface SetupStateBase {
  candidateSavingsAccounts: SetupSavingsCandidateDto[];
  isComplete: boolean;
}

export type SetupState =
  | (SetupStateBase & {
      step: "preferences";
      isComplete: false;
      preferences: null;
      savingsAccount: null;
      initialBalance: null;
    })
  | (SetupStateBase & {
      step: "savingsAccount";
      isComplete: false;
      preferences: SetupPreferencesDto;
      savingsAccount: null;
      initialBalance: null;
    })
  | (SetupStateBase & {
      step: "initialBalance";
      isComplete: false;
      preferences: SetupPreferencesDto;
      savingsAccount: SetupSavingsAccountDto;
      initialBalance: null;
    })
  | (SetupStateBase & {
      step: "complete";
      isComplete: true;
      preferences: SetupPreferencesDto;
      savingsAccount: SetupSavingsAccountDto;
      initialBalance: SetupBalanceDto;
    });

export type SetupFormErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_LOCALE"
  | "INVALID_TIME_ZONE"
  | "INVALID_BASE_CURRENCY"
  | "BASE_CURRENCY_LOCKED"
  | "ACTIVATED_SETUP_LOCKED"
  | "PREFERENCES_REQUIRED"
  | "INVALID_ACCOUNT_MODE"
  | "INVALID_ACCOUNT_NAME"
  | "INVALID_INSTITUTION"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_NOT_SAVINGS"
  | "SAVINGS_ACCOUNT_REQUIRED"
  | "INVALID_BALANCE"
  | "INVALID_RECORDED_AT"
  | "INITIAL_BALANCE_CONFLICT"
  | "INITIAL_BALANCE_LOCKED"
  | "SETUP_SAVE_FAILED";

export interface SetupFormError {
  code: SetupFormErrorCode;
  field?: string;
}

export type SetupFormState =
  | { status: "idle"; error: null }
  | { status: "error"; error: SetupFormError };

export const INITIAL_SETUP_FORM_STATE: SetupFormState = {
  status: "idle",
  error: null,
};
