"use client";

import { useState } from "react";
import { addImpulseLog } from "@/app/(app)/impulse/actions";
import type { ImpulseLog } from "@/lib/types/database";

interface ImpulseFormProps {
  onAdded: (log: ImpulseLog) => void;
}

export function ImpulseForm({ onAdded }: ImpulseFormProps) {
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
      <h3 className="text-lg font-semibold text-gray-900">记录一次「忍住了」</h3>
      <p className="mt-1 text-sm text-gray-500">
        想买但忍住了？记录下来，看看省了多少钱！
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
              想买什么
            </label>
            <input
              id="item_name"
              name="item_name"
              type="text"
              required
              placeholder="如：AirPods Max"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label htmlFor="estimated_price" className="block text-sm font-medium text-gray-700">
              大约多少钱（¥）
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
              为什么忍住了
            </label>
            <input
              id="reason"
              name="reason"
              type="text"
              placeholder="再等一年"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "记录中…" : "我忍住了！💪"}
        </button>
      </form>
    </div>
  );
}
