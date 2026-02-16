"use client";

import { useState } from "react";
import type { Account, SopTemplate } from "@/lib/types/database";
import { SopTemplateForm } from "./sop-template-form";
import {
  createSopTemplate,
  updateSopTemplate,
  deleteSopTemplate,
} from "@/app/(app)/settings/actions";

interface SopTemplateEditorProps {
  initialTemplates: SopTemplate[];
  accounts: Account[];
}

export function SopTemplateEditor({
  initialTemplates,
  accounts,
}: SopTemplateEditorProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SopTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getAccountName(id: string | null) {
    if (!id) return "—";
    const account = accounts.find((a) => a.id === id);
    return account ? `${account.icon} ${account.name}` : "—";
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createSopTemplate(formData);
    if (result.success) {
      setTemplates((prev) => [...prev, result.data]);
      setShowForm(false);
    } else {
      setError(result.error);
    }
  }

  async function handleUpdate(formData: FormData) {
    if (!editingTemplate) return;
    setError(null);
    const result = await updateSopTemplate(editingTemplate.id, formData);
    if (result.success) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                step_key: formData.get("step_key") as string,
                step_label: formData.get("step_label") as string,
                due_day: Number(formData.get("due_day")),
                from_account_id: (formData.get("from_account_id") as string) || null,
                to_account_id: (formData.get("to_account_id") as string) || null,
                default_amount: formData.get("default_amount")
                  ? Number(formData.get("default_amount"))
                  : null,
                is_active: formData.get("is_active") === "true",
              }
            : t
        )
      );
      setEditingTemplate(null);
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定要删除此 SOP 模板吗？")) return;
    const result = await deleteSopTemplate(id);
    if (result.success) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
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
        {templates.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            还没有 SOP 模板，点击下方按钮添加。
          </div>
        ) : (
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">步骤</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">执行日</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">源 → 目标</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">金额</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{tpl.step_label}</div>
                    <div className="text-xs text-gray-400">{tpl.step_key}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">每月 {tpl.due_day} 号</td>
                  <td className="px-4 py-3 text-gray-600">
                    {getAccountName(tpl.from_account_id)} → {getAccountName(tpl.to_account_id)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {tpl.default_amount != null ? `¥${tpl.default_amount.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        tpl.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {tpl.is_active ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingTemplate(tpl)}
                      className="cursor-pointer text-gray-400 transition-colors hover:text-orange-500"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl.id)}
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

      {editingTemplate && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">编辑 SOP 步骤</h4>
          <SopTemplateForm
            template={editingTemplate}
            accounts={accounts}
            onSubmit={handleUpdate}
            onCancel={() => setEditingTemplate(null)}
          />
        </div>
      )}

      {showForm ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">添加 SOP 步骤</h4>
          <SopTemplateForm
            accounts={accounts}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-orange-300 hover:text-orange-500"
        >
          + 添加 SOP 步骤
        </button>
      )}
    </div>
  );
}
