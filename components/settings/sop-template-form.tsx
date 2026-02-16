"use client";

import { useState } from "react";
import type { Account, SopTemplate } from "@/lib/types/database";

interface SopTemplateFormProps {
  template?: SopTemplate;
  accounts: Account[];
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}

export function SopTemplateForm({
  template,
  accounts,
  onSubmit,
  onCancel,
}: SopTemplateFormProps) {
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("is_active", String(isActive));
    await onSubmit(formData);
    setLoading(false);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="step_key" className="block text-sm font-medium text-gray-700">
            步骤标识
          </label>
          <input
            id="step_key"
            name="step_key"
            type="text"
            required
            defaultValue={template?.step_key}
            placeholder="如：transfer_savings"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="step_label" className="block text-sm font-medium text-gray-700">
            步骤名称
          </label>
          <input
            id="step_label"
            name="step_label"
            type="text"
            required
            defaultValue={template?.step_label}
            placeholder="如：转账至储蓄账户"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="due_day" className="block text-sm font-medium text-gray-700">
            执行日
          </label>
          <input
            id="due_day"
            name="due_day"
            type="number"
            inputMode="decimal"
            required
            min={1}
            max={31}
            defaultValue={template?.due_day || 10}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="from_account_id" className="block text-sm font-medium text-gray-700">
            源账户
          </label>
          <select
            id="from_account_id"
            name="from_account_id"
            defaultValue={template?.from_account_id || ""}
            className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">无</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="to_account_id" className="block text-sm font-medium text-gray-700">
            目标账户
          </label>
          <select
            id="to_account_id"
            name="to_account_id"
            defaultValue={template?.to_account_id || ""}
            className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">无</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="default_amount" className="block text-sm font-medium text-gray-700">
            默认金额（¥）
          </label>
          <input
            id="default_amount"
            name="default_amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={template?.default_amount ?? ""}
            placeholder="可选"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">启用</span>
          </label>
        </div>
      </div>

      <input type="hidden" name="sort_order" value={template?.sort_order ?? 0} />

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
          {loading ? "保存中…" : template ? "更新" : "添加"}
        </button>
      </div>
    </form>
  );
}
