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
import { formatMoney } from "@/lib/format-money";
import {
  getIncomeErrorMessage,
  type IncomeCopy,
} from "@/lib/income/presentation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface BonusEventsListProps {
  initialEvents: BonusEvent[];
  accounts: Account[];
  locale: string;
  baseCurrency: string;
  copy: IncomeCopy;
}

function formatCalendarDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function BonusEventsList({
  initialEvents,
  accounts,
  locale,
  baseCurrency,
  copy,
}: BonusEventsListProps) {
  const [events, setEvents] = useState(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BonusEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      setError(getIncomeErrorMessage(result.error, copy));
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteBonusEvent(id);
    if (result.success) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } else setError(getIncomeErrorMessage(result.error, copy));
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
    } else setError(getIncomeErrorMessage(result.error, copy));
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
      setError(getIncomeErrorMessage(result.error, copy));
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {copy.bonuses.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {copy.bonuses.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          {copy.bonuses.add}
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <BonusEventForm
            accounts={accounts}
            baseCurrency={baseCurrency}
            copy={copy.bonusForm}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {events.length === 0 ? (
        <div className="mt-4 text-center text-sm text-gray-400">
          {copy.bonuses.empty}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left font-medium text-gray-500">{copy.bonuses.type}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">{copy.bonuses.name}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">{copy.bonuses.amount}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">{copy.bonuses.date}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">{copy.bonuses.targetAccount}</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">{copy.bonuses.status}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">{copy.bonuses.actions}</th>
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
                          baseCurrency={baseCurrency}
                          copy={copy.bonusForm}
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
                        {event.type === "signing_bonus"
                          ? copy.bonusForm.signingBonus
                          : event.type === "year_end_bonus"
                            ? copy.bonusForm.yearEndBonus
                            : copy.bonusForm.other}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{event.label}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">
                      {formatMoney(event.amount, locale, baseCurrency)}
                      {event.actual_amount != null && (
                        <div className="text-xs text-green-600">
                          {copy.bonuses.actual}{" "}
                          {formatMoney(event.actual_amount, locale, baseCurrency)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {formatCalendarDate(event.expected_date, locale)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {getAccountName(event.target_account_id)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {event.is_received ? (
                        <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          {copy.bonuses.received}
                        </span>
                      ) : receivingId === event.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={receiveAmount}
                            onChange={(e) => setReceiveAmount(e.target.value)}
                            placeholder={copy.bonuses.actualAmount}
                            aria-label={copy.bonuses.actualAmount}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleMarkReceived(event.id)}
                            className="cursor-pointer rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
                          >
                            {copy.bonuses.confirm}
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
                          {copy.bonuses.markReceived}
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
                          {copy.bonuses.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(event.id)}
                          className="cursor-pointer text-gray-400 transition-colors hover:text-red-500"
                        >
                          {copy.bonuses.delete}
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
      <ConfirmDialog
        open={pendingDeleteId !== null}
        description={copy.bonuses.deleteConfirm}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) return handleDelete(pendingDeleteId);
        }}
      />
    </div>
  );
}
