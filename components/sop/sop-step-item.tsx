"use client";

import { useState } from "react";
import type { SopDisplayRecord } from "@/lib/sop/contracts";
import { toggleSopStep, updateSopStep, deleteAdHocSopStep } from "@/app/(app)/sop/actions";
import { formatMoney } from "@/lib/format-money";
import { getSopErrorMessage, type SopCopy } from "@/lib/sop/presentation";

interface SopStepItemProps {
  record: SopDisplayRecord;
  locale: string;
  baseCurrency: string;
  readOnly?: boolean;
  onUpdated: (updated: SopDisplayRecord) => void;
  onDeleted?: (id: string) => void;
  copy: SopCopy["step"];
  errorCopy: SopCopy["errors"];
}

export function SopStepItem({
  record,
  locale,
  baseCurrency,
  readOnly = false,
  onUpdated,
  onDeleted,
  copy,
  errorCopy,
}: SopStepItemProps) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(record.amount ?? ""));
  const [note, setNote] = useState(record.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const isMonthlyAction = record.scheduled_for != null;

  async function handleToggle() {
    setLoading(true);
    const result = await toggleSopStep(record.id, !record.completed);
    if (result.success) {
      onUpdated({
        ...record,
        completed: !record.completed,
        completed_at: !record.completed ? new Date().toISOString() : null,
      });
      setError(null);
    } else setError(getSopErrorMessage(result.error, errorCopy));
    setLoading(false);
  }

  const isAdHoc = record.is_ad_hoc;

  async function handleDelete() {
    if (!window.confirm(copy.deleteConfirm)) return;
    setLoading(true);
    const result = await deleteAdHocSopStep(record.id);
    if (result.success) {
      onDeleted?.(record.id);
      setError(null);
    } else setError(getSopErrorMessage(result.error, errorCopy));
    setLoading(false);
  }

  async function handleSave() {
    setLoading(true);
    const data: { note?: string; amount?: number } = {};
    if (note !== (record.note ?? "")) data.note = note;
    if (amount && Number(amount) !== record.amount) data.amount = Number(amount);

    if (Object.keys(data).length > 0) {
      const result = await updateSopStep(record.id, data);
      if (result.success) {
        onUpdated({ ...record, ...data });
        setError(null);
      } else setError(getSopErrorMessage(result.error, errorCopy));
    }
    setEditing(false);
    setLoading(false);
  }

  const fromLabel = record.source_account_name;
  const toLabel = record.target_account_name;

  const transferLabel =
    fromLabel && toLabel ? `${fromLabel} → ${toLabel}` : record.step_label;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        record.completed
          ? "border-green-200 bg-green-50/50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        {readOnly ? (
          <span
            aria-label={
              record.completed
                ? copy.completedClosed
                : copy.incompleteClosed
            }
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
              record.completed
                ? "border-green-500 bg-green-500 text-white"
                : "border-gray-300 bg-gray-100"
            }`}
          >
            {record.completed ? <Checkmark /> : null}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            className={`mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
              record.completed
                ? "border-green-500 bg-green-500 text-white"
                : "border-gray-300 hover:border-orange-400"
            }`}
            aria-label={record.completed ? copy.markIncomplete : copy.markComplete}
          >
            {record.completed ? <Checkmark /> : null}
          </button>
        )}

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              {isAdHoc && (
                <span className="mr-1.5 inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">
                  {copy.temporary}
                </span>
              )}
              <span
                className={`font-medium ${
                  record.completed ? "text-green-700 line-through" : "text-gray-900"
                }`}
              >
                {transferLabel}
              </span>
              {record.amount != null && (
                <p className="mt-1 font-mono text-sm text-gray-500">
                  {isMonthlyAction ? `${copy.monthlyActionAmount}: ` : ""}
                  {formatMoney(record.amount, locale, baseCurrency)}
                </p>
              )}
            </div>

            {!readOnly && !record.completed && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(!editing)}
                  className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-orange-500"
                >
                  {editing ? copy.cancel : copy.edit}
                </button>
                {isAdHoc && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-red-500"
                  >
                    {copy.delete}
                  </button>
                )}
              </div>
            )}
          </div>

          {record.completed && record.completed_at && (
            <p className="mt-1 text-xs text-green-600">
              {copy.completedAt}{" "}
              {new Date(record.completed_at).toLocaleString(locale, {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {record.note && (
                <span className="ml-2 text-gray-500">
                  {copy.note}: {record.note}
                </span>
              )}
            </p>
          )}

          {editing && !readOnly && !record.completed && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={isMonthlyAction ? copy.monthlyActionAmount : copy.amount}
                  aria-label={isMonthlyAction ? copy.monthlyActionAmount : copy.amount}
                  className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={copy.note}
                  aria-label={copy.note}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="cursor-pointer rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {copy.save}
                </button>
              </div>
              {isMonthlyAction ? (
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  {copy.monthlyActionHelp}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Checkmark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}
