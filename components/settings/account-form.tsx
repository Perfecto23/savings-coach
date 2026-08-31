"use client";

import { useState } from "react";
import type { Account, AccountPurpose } from "@/lib/types/database";
import type { SettingsCopy } from "@/lib/settings/presentation";

interface AccountFormProps {
  account?: Account;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
  copy: SettingsCopy["accountForm"];
}

export function AccountForm({ account, onSubmit, onCancel, copy }: AccountFormProps) {
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
            {copy.name}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={account?.name}
            placeholder={copy.namePlaceholder}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label htmlFor="bank" className="block text-sm font-medium text-gray-700">
            {copy.institution}
          </label>
          <input
            id="bank"
            name="bank"
            type="text"
            defaultValue={account?.bank ?? ""}
            placeholder={copy.institutionPlaceholder}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
            {copy.purpose}
          </label>
          <select
            id="purpose"
            name="purpose"
            required
            defaultValue={account?.purpose || "salary"}
            className="mt-1 block w-full cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {(Object.keys(copy.purposes) as AccountPurpose[]).map((value) => (
              <option key={value} value={value}>
                {copy.purposes[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="icon" className="block text-sm font-medium text-gray-700">
            {copy.icon}
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
          {copy.cancel}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? copy.saving : account ? copy.update : copy.add}
        </button>
      </div>
    </form>
  );
}
