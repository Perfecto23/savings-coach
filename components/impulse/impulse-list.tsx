"use client";

import type { ImpulseLog } from "@/lib/types/database";
import { deleteImpulseLog } from "@/app/(app)/impulse/actions";
import { formatMoney } from "@/lib/format-money";
import { formatImpulseDate, type ImpulseCopy } from "@/lib/impulse/presentation";

interface ImpulseListProps {
  logs: ImpulseLog[];
  locale: string;
  baseCurrency: string;
  copy: ImpulseCopy["list"];
  onDeleted: (id: string) => void;
}

export function ImpulseList({
  logs,
  locale,
  baseCurrency,
  copy,
  onDeleted,
}: ImpulseListProps) {
  async function handleDelete(id: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    const result = await deleteImpulseLog(id);
    if (result.success) {
      onDeleted(id);
    }
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        {copy.empty}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="font-semibold text-gray-900">{copy.title}</h3>
      </div>
      <ul className="divide-y divide-gray-50">
        {logs.map((log) => (
          <li key={log.id} className="flex items-center justify-between px-6 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="truncate font-medium text-gray-900">{log.item_name}</span>
                <span
                  aria-label={`${copy.amountAriaLabel}${locale.toLowerCase().startsWith("zh") ? "：" : ": "}${formatMoney(log.estimated_price, locale, baseCurrency)}`}
                  className="font-mono text-sm text-green-600"
                >
                  {formatMoney(log.estimated_price, locale, baseCurrency)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                <span>{formatImpulseDate(log.logged_at, locale)}</span>
                {log.reason && (
                  <span className="text-gray-500">· {log.reason}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(log.id)}
              className="cursor-pointer text-xs text-gray-300 transition-colors hover:text-red-500"
            >
              {copy.delete}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
