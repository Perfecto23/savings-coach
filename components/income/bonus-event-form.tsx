"use client";

import { useState } from "react";
import type { Account, BonusEvent } from "@/lib/types/database";

const BONUS_TYPES = [
  { value: "signing_bonus", label: "签字费" },
  { value: "year_end_bonus", label: "年终奖" },
  { value: "other", label: "其他" },
];

interface BonusEventFormProps {
  event?: BonusEvent;
  accounts: Account[];
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}

export function BonusEventForm({
  event,
  accounts,
  onSubmit,
  onCancel,
}: BonusEventFormProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            类型
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue={event?.type || "signing_bonus"}
            className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {BONUS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="label" className="block text-sm font-medium text-gray-700">
            名称
          </label>
          <input
            id="label"
            name="label"
            type="text"
            required
            defaultValue={event?.label}
            placeholder="如：26年6月签字费"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            税前金额（¥）
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            required
            defaultValue={event?.amount}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="expected_date" className="block text-sm font-medium text-gray-700">
            预计日期
          </label>
          <input
            id="expected_date"
            name="expected_date"
            type="date"
            required
            defaultValue={event?.expected_date}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="target_account_id" className="block text-sm font-medium text-gray-700">
            计划存入账户
          </label>
          <select
            id="target_account_id"
            name="target_account_id"
            defaultValue={event?.target_account_id || ""}
            className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">未指定</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-700">
            备注
          </label>
          <input
            id="note"
            name="note"
            type="text"
            defaultValue={event?.note ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? "保存中…" : event ? "更新" : "添加"}
        </button>
      </div>
    </form>
  );
}
