"use client";

import { useState } from "react";
import type { Account } from "@/lib/types/database";
import { AccountForm } from "./account-form";
import { createAccount, updateAccount, deleteAccount } from "@/app/(app)/settings/actions";
import {
  getSettingsErrorMessage,
  type SettingsCopy,
} from "@/lib/settings/presentation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AccountManagerProps {
  initialAccounts: Account[];
  copy: SettingsCopy;
}

export function AccountManager({ initialAccounts, copy }: AccountManagerProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createAccount(formData);
    if (result.success) {
      setAccounts((prev) => [...prev, result.data]);
      setShowForm(false);
    } else {
      setError(getSettingsErrorMessage(result.error, copy));
    }
  }

  async function handleUpdate(formData: FormData) {
    if (!editingAccount) return;
    setError(null);
    const result = await updateAccount(editingAccount.id, formData);
    if (result.success) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccount.id
            ? {
                ...a,
                name: formData.get("name") as string,
                bank: String(formData.get("bank") || "").trim() || null,
                purpose: formData.get("purpose") as string,
                icon: (formData.get("icon") as string) || "🏦",
              } as Account
            : a
        )
      );
      setEditingAccount(null);
    } else {
      setError(getSettingsErrorMessage(result.error, copy));
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteAccount(id);
    if (result.success) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } else {
      setError(getSettingsErrorMessage(result.error, copy));
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {copy.accounts.empty}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">{copy.accounts.icon}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{copy.accounts.name}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{copy.accounts.institution}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{copy.accounts.purpose}</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">{copy.accounts.actions}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-lg">{account.icon}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
                  <td className="px-4 py-3 text-gray-600">{account.bank || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      {copy.accountForm.purposes[account.purpose] || account.purpose}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingAccount(account)}
                      className="cursor-pointer text-gray-400 transition-colors hover:text-orange-500"
                    >
                      {copy.accounts.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(account.id)}
                      className="ml-3 cursor-pointer text-gray-400 transition-colors hover:text-red-500"
                    >
                      {copy.accounts.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {editingAccount && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">
            {copy.accounts.editTitle}
          </h4>
          <AccountForm
            account={editingAccount}
            onSubmit={handleUpdate}
            onCancel={() => setEditingAccount(null)}
            copy={copy.accountForm}
          />
        </div>
      )}

      {showForm ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">
            {copy.accounts.addTitle}
          </h4>
          <AccountForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            copy={copy.accountForm}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-orange-300 hover:text-orange-500"
        >
          {copy.accounts.add}
        </button>
      )}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        description={copy.accounts.deleteConfirm}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) return handleDelete(pendingDeleteId);
        }}
      />
    </div>
  );
}
