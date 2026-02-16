"use client";

import { useState } from "react";
import type { Account, AccountPurpose } from "@/lib/types/database";

const PURPOSE_OPTIONS: { value: AccountPurpose; label: string }[] = [
  { value: "salary", label: "工资卡" },
  { value: "fixed_expense", label: "固定开支" },
  { value: "dating_fund", label: "恋爱享乐基金" },
  { value: "savings", label: "储蓄" },
  { value: "flexible", label: "弹性消费" },
  { value: "housing_fund", label: "公积金" },
];

interface AccountFormProps {
  account?: Account;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}

export function AccountForm({ account, onSubmit, onCancel }: AccountFormProps) {
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
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            账户名称
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={account?.name}
            placeholder="如：招商银行工资卡"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="bank" className="block text-sm font-medium text-gray-700">
            银行/机构
          </label>
          <input
            id="bank"
            name="bank"
            type="text"
            required
            defaultValue={account?.bank}
            placeholder="如：招商银行"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
            用途
          </label>
          <select
            id="purpose"
            name="purpose"
            required
            defaultValue={account?.purpose || "salary"}
            className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="icon" className="block text-sm font-medium text-gray-700">
            图标
          </label>
          <input
            id="icon"
            name="icon"
            type="text"
            defaultValue={account?.icon || "🏦"}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <input type="hidden" name="sort_order" value={account?.sort_order ?? 0} />

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
          {loading ? "保存中…" : account ? "更新" : "添加"}
        </button>
      </div>
    </form>
  );
}
