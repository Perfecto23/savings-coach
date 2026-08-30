"use client";

import { useState } from "react";
import type { Account } from "@/lib/types/database";
import { saveBalanceSnapshot } from "@/app/(app)/balances/actions";

interface BalanceFormProps {
  accounts: Account[];
  baseCurrency: string;
  defaultDate: string;
}

export function BalanceForm({ accounts, baseCurrency, defaultDate }: BalanceFormProps) {
  const [date, setDate] = useState(defaultDate);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <h3 className="text-lg font-semibold text-gray-900">Record Balance Snapshots</h3>
      <p className="mt-1 text-sm leading-6 text-gray-500">
        This saves your observation. It does not confirm a bank balance.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="balance-date" className="block text-sm font-medium text-gray-700">
            Observation date
          </label>
          <input
            id="balance-date"
            type="date"
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
                  placeholder="Observed balance"
                  aria-label={`${account.name} Balance Snapshot`}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-16 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            Balance Snapshot saved. Savings Coach does not verify a bank balance.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save Balance Snapshots"}
        </button>
      </form>
    </div>
  );
}
