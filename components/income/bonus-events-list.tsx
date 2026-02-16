"use client";

import { useState } from "react";
import type { Account, BonusEvent, BonusType } from "@/lib/types/database";
import { BonusEventForm } from "./bonus-event-form";
import {
  addBonusEvent,
  deleteBonusEvent,
  markBonusReceived,
  updateBonusEvent,
} from "@/app/(app)/income/actions";

const TYPE_LABELS: Record<string, string> = {
  signing_bonus: "签字费",
  year_end_bonus: "年终奖",
  other: "其他",
};

interface BonusEventsListProps {
  initialEvents: BonusEvent[];
  accounts: Account[];
}

export function BonusEventsList({ initialEvents, accounts }: BonusEventsListProps) {
  const [events, setEvents] = useState(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BonusEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");

  function getAccountName(id: string | null) {
    if (!id) return "—";
    const account = accounts.find((a) => a.id === id);
    return account ? `${account.icon} ${account.name}` : "—";
  }

  function sortByDate(list: BonusEvent[]) {
    return [...list].sort((a, b) => a.expected_date.localeCompare(b.expected_date));
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await addBonusEvent(formData);
    if (result.success) {
      setEvents((prev) => sortByDate([...prev, result.data]));
      setShowForm(false);
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定要删除此奖金事件吗？")) return;
    const result = await deleteBonusEvent(id);
    if (result.success) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  }

  async function handleMarkReceived(id: string) {
    const amount = Number(receiveAmount);
    if (!amount || amount <= 0) return;

    const result = await markBonusReceived(id, amount);
    if (result.success) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, is_received: true, actual_amount: amount } : e
        )
      );
      setReceivingId(null);
      setReceiveAmount("");
    }
  }

  async function handleUpdate(id: string, formData: FormData) {
    setError(null);
    const result = await updateBonusEvent(id, formData);
    if (result.success) {
      const type = formData.get("type") as BonusType;
      const label = formData.get("label") as string;
      const amount = Number(formData.get("amount"));
      const expected_date = formData.get("expected_date") as string;
      const target_account_id = (formData.get("target_account_id") as string) || null;
      const note = (formData.get("note") as string) || null;
      setEvents((prev) =>
        sortByDate(
          prev.map((e) =>
            e.id === id
              ? { ...e, type, label, amount, expected_date, target_account_id, note }
              : e
          )
        )
      );
      setEditingEvent(null);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">奖金事件</h3>
          <p className="mt-1 text-sm text-gray-500">签字费、年终奖等一次性收入</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          + 添加
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <BonusEventForm
            accounts={accounts}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {events.length === 0 ? (
        <div className="mt-4 text-center text-sm text-gray-400">暂无奖金事件</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left font-medium text-gray-500">类型</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">名称</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">金额</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">日期</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">存入账户</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">状态</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) =>
                editingEvent?.id === event.id ? (
                  <tr key={event.id} className="border-b border-gray-50 last:border-0">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                        <BonusEventForm
                          event={event}
                          accounts={accounts}
                          onSubmit={(formData) => handleUpdate(event.id, formData)}
                          onCancel={() => setEditingEvent(null)}
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={event.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {TYPE_LABELS[event.type] || event.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{event.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">
                      ¥{event.amount.toLocaleString()}
                      {event.actual_amount != null && (
                        <div className="text-xs text-green-600">
                          实际 ¥{event.actual_amount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{event.expected_date}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {getAccountName(event.target_account_id)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {event.is_received ? (
                        <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          已到账
                        </span>
                      ) : receivingId === event.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={receiveAmount}
                            onChange={(e) => setReceiveAmount(e.target.value)}
                            placeholder="实际金额"
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleMarkReceived(event.id)}
                            className="cursor-pointer rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
                          >
                            确认
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReceivingId(event.id);
                            setReceiveAmount(String(event.amount));
                          }}
                          className="cursor-pointer text-xs text-orange-500 hover:text-orange-600"
                        >
                          标记到账
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEvent(event)}
                          className="cursor-pointer text-gray-400 transition-colors hover:text-orange-600"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(event.id)}
                          className="cursor-pointer text-gray-400 transition-colors hover:text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
