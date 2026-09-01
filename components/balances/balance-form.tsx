"use client";

import { useState } from "react";
import type { Account } from "@/lib/types/database";
import { saveBalanceSnapshot } from "@/app/(app)/balances/actions";
import type {
  BalanceActionErrorCode,
  BalancesCopy,
} from "@/lib/balances/presentation";

interface BalanceFormProps {
  accounts: Account[];
  baseCurrency: string;
  defaultDate: string;
  copy: BalancesCopy["form"];
  errorCopy: BalancesCopy["errors"];
}

export function BalanceForm({
  accounts,
  baseCurrency,
  defaultDate,
  copy,
  errorCopy,
}: BalanceFormProps) {
  const [date, setDate] = useState(defaultDate);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<BalanceActionErrorCode | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const balances = accounts
      .filter((a) => values[a.id] && Number(values[a.id]) >= 0)
      .map((a) => ({
        account_id: a.id,
        balance: Number(values[a.id]),
      }));

    const result = await saveBalanceSnapshot(date, balances);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">{copy.title}</h3>
      <p className="mt-1 text-sm leading-6 text-gray-500">
        {copy.description}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        <div>
          <label htmlFor="balance-date" className="block text-sm font-medium text-gray-700">
            {copy.dateLabel}
          </label>
          <input
            id="balance-date"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2 sm:w-40">
                <span className="w-6 text-center text-lg">{account.icon}</span>
                <span className="text-sm font-medium text-gray-700">
                  {account.name}
                </span>
              </div>
              <div className="relative flex-1">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  {baseCurrency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={values[account.id] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [account.id]: e.target.value,
                    }))
                  }
                  placeholder={copy.balancePlaceholder}
                  aria-label={copy.balanceAria.replace("{account}", account.name)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-16 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {errorCopy[error]}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            {copy.success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? copy.saving : copy.submit}
        </button>
      </form>
    </div>
  );
}
