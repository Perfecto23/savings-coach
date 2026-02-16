"use client";

import { useState } from "react";
import type { Account } from "@/lib/types/database";
import { AccountForm } from "./account-form";
import { createAccount, updateAccount, deleteAccount } from "@/app/(app)/settings/actions";

const PURPOSE_LABELS: Record<string, string> = {
  salary: "工资卡",
  fixed_expense: "固定开支",
  dating_fund: "恋爱享乐基金",
  savings: "储蓄",
  flexible: "弹性消费",
  housing_fund: "公积金",
};

interface AccountManagerProps {
  initialAccounts: Account[];
}

export function AccountManager({ initialAccounts }: AccountManagerProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createAccount(formData);
    if (result.success) {
      setAccounts((prev) => [...prev, result.data]);
      setShowForm(false);
    } else {
      setError(result.error);
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
                bank: formData.get("bank") as string,
                purpose: formData.get("purpose") as string,
                icon: (formData.get("icon") as string) || "🏦",
              } as Account
            : a
        )
      );
      setEditingAccount(null);
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定要删除此账户吗？关联的余额快照和 SOP 模板也会被删除。")) return;
    const result = await deleteAccount(id);
    if (result.success) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
        {accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            还没有账户，点击下方按钮添加。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">图标</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">银行</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">用途</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-lg">{account.icon}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
                  <td className="px-4 py-3 text-gray-600">{account.bank}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      {PURPOSE_LABELS[account.purpose] || account.purpose}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingAccount(account)}
                      className="cursor-pointer text-gray-400 transition-colors hover:text-orange-500"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account.id)}
                      className="ml-3 cursor-pointer text-gray-400 transition-colors hover:text-red-500"
                    >
                      删除
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
          <h4 className="mb-3 text-sm font-medium text-gray-700">编辑账户</h4>
          <AccountForm
            account={editingAccount}
            onSubmit={handleUpdate}
            onCancel={() => setEditingAccount(null)}
          />
        </div>
      )}

      {showForm ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">添加新账户</h4>
          <AccountForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-orange-300 hover:text-orange-500"
        >
          + 添加账户
        </button>
      )}
    </div>
  );
}
