"use client";

import { useState } from "react";
import { addImpulseLog } from "@/app/(app)/impulse/actions";
import type { ImpulseLog } from "@/lib/types/database";

interface ImpulseFormProps {
  baseCurrency: string;
  onAdded: (log: ImpulseLog) => void;
}

export function ImpulseForm({ baseCurrency, onAdded }: ImpulseFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await addImpulseLog(formData);
    if (result.success) {
      onAdded(result.data);
      // 重置表单
      const form = document.getElementById("impulse-form") as HTMLFormElement;
      form?.reset();
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Log an impulse check</h3>
      <p className="mt-1 text-sm text-gray-500">
        Record the estimated price of a purchase you decided not to make. This is not confirmed savings.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form id="impulse-form" action={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="item_name" className="block text-sm font-medium text-gray-700">
              What did you decide not to buy?
            </label>
            <input
              id="item_name"
              name="item_name"
              type="text"
              required
              placeholder="For example, headphones"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="estimated_price" className="block text-sm font-medium text-gray-700">
              Impulse amount ({baseCurrency})
            </label>
            <input
              id="estimated_price"
              name="estimated_price"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              placeholder="3999"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              Why did you pause?
            </label>
            <input
              id="reason"
              name="reason"
              type="text"
              placeholder="For example, I will wait a week"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Recording…" : "Log impulse check"}
        </button>
      </form>
    </div>
  );
}
