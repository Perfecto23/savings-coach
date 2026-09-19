"use client";

import { useState } from "react";
import type { SopDisplayRecord } from "@/lib/sop/contracts";
import { SopStepItem } from "./sop-step-item";
import { initMonthSop, addAdHocSopStep } from "@/app/(app)/sop/actions";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Confetti } from "@/components/ui/confetti";
import { getSopErrorMessage, type SopCopy } from "@/lib/sop/presentation";

interface SopChecklistProps {
  initialRecords: SopDisplayRecord[];
  yearMonth: string;
  locale: string;
  baseCurrency: string;
  isPlanActivated: boolean;
  isClosed: boolean;
  copy: SopCopy["checklist"];
  stepCopy: SopCopy["step"];
  errorCopy: SopCopy["errors"];
}

export function SopChecklist({
  initialRecords,
  yearMonth,
  locale,
  baseCurrency,
  isPlanActivated,
  isClosed,
  copy,
  stepCopy,
  errorCopy,
}: SopChecklistProps) {
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showAdHocForm, setShowAdHocForm] = useState(false);
  const [adHocLabel, setAdHocLabel] = useState("");
  const [adHocDay, setAdHocDay] = useState("10");
  const [adHocAmount, setAdHocAmount] = useState("");
  const [adHocNote, setAdHocNote] = useState("");
  const [adHocLoading, setAdHocLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleInitialize() {
    setLoading(true);
    const result = await initMonthSop(yearMonth);
    if (result.success) {
      setRecords(result.data);
      setError(null);
    } else {
      setError(getSopErrorMessage(result.error, errorCopy));
    }
    setLoading(false);
  }

  function handleRecordUpdated(updated: SopDisplayRecord) {
    setRecords((prev) => {
      const next = prev.map((r) => (r.id === updated.id ? updated : r));
      if (next.length > 0 && next.every((r) => r.completed)) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
      return next;
    });
  }

  function handleRecordDeleted(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleAddAdHoc() {
    if (!adHocLabel.trim()) return;
    setAdHocLoading(true);
    const result = await addAdHocSopStep(yearMonth, {
      step_label: adHocLabel.trim(),
      due_day: Number(adHocDay),
      amount: adHocAmount ? Number(adHocAmount) : undefined,
      note: adHocNote || undefined,
    });
    if (result.success) {
      setRecords((prev) => [...prev, result.data]);
      setAdHocLabel("");
      setAdHocDay("10");
      setAdHocAmount("");
      setAdHocNote("");
      setShowAdHocForm(false);
      setError(null);
    } else setError(getSopErrorMessage(result.error, errorCopy));
    setAdHocLoading(false);
  }

  const completed = records.filter((r) => r.completed).length;
  const total = records.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 按 due_day 分组
  const groups = records.reduce(
    (acc, record) => {
      const key = record.due_day;
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    },
    {} as Record<number, SopDisplayRecord[]>
  );

  const sortedDays = Object.keys(groups)
    .map(Number)
    .toSorted((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500"
          role="status"
          aria-label={copy.loading}
        />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          {isPlanActivated ? (
            <>
              {copy.emptyBeforeSettings}{" "}
              <a href="/settings" className="font-medium text-orange-500 hover:text-orange-600">
                {copy.emptyLink}
              </a>
              {copy.emptyAfterLink}
            </>
          ) : (
            <>
              {copy.emptyBeforePlan}{" "}
              <a href="/plan" className="font-medium text-orange-500 hover:text-orange-600">
                {copy.planLink}
              </a>
            </>
          )}
        </p>
        {isPlanActivated && !isClosed ? (
          <>
            <p className="mt-2 text-sm text-gray-400">{copy.initializeHelp}</p>
            <button
              type="button"
              onClick={handleInitialize}
              disabled={loading}
              className="mt-5 cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? copy.initializing : copy.initialize}
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Confetti active={showCelebration} duration={3000} />

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {isClosed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          {copy.closed}
        </div>
      ) : null}

      {/* 进度 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <ProgressRing
            progress={progressPct}
            size={80}
            strokeWidth={6}
            label={`${progressPct}%`}
            sublabel={`${completed}/${total}`}
          />
          <div className="flex-1">
            <p className="font-medium text-gray-700">{copy.progress}</p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-linear-to-r from-orange-400 to-orange-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 庆祝 */}
      {showCelebration && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-2xl font-bold text-green-700">
            {copy.celebrationTitle}
          </p>
          <p className="mt-1 text-sm text-green-600">
            {copy.celebrationDescription}
          </p>
        </div>
      )}

      {/* 按日期分组的步骤 */}
      {sortedDays.map((day) => (
        <div key={day}>
          <h3 className="mb-3 text-sm font-semibold text-gray-500">
            {copy.dayPrefix} {day} {copy.daySuffix}
          </h3>
          <div className="space-y-2">
            {groups[day].map((record) => (
              <SopStepItem
                key={record.id}
                record={record}
                locale={locale}
                baseCurrency={baseCurrency}
                readOnly={isClosed}
                onUpdated={handleRecordUpdated}
                onDeleted={handleRecordDeleted}
                copy={stepCopy}
                errorCopy={errorCopy}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 添加临时步骤 */}
      {!isClosed ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
          {showAdHocForm ? (
            <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">
              {copy.addTemporaryTitle}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={adHocLabel}
                onChange={(e) => setAdHocLabel(e.target.value)}
                placeholder={copy.temporaryNamePlaceholder}
                aria-label={copy.temporaryNameAria}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={adHocDay}
                  onChange={(e) => setAdHocDay(e.target.value)}
                  placeholder={copy.dueDay}
                  aria-label={copy.dueDay}
                  min={1}
                  max={31}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={adHocAmount}
                  onChange={(e) => setAdHocAmount(e.target.value)}
                  placeholder={copy.amountOptional}
                  aria-label={copy.amount}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
            <input
              type="text"
              value={adHocNote}
              onChange={(e) => setAdHocNote(e.target.value)}
              placeholder={copy.noteOptional}
              aria-label={copy.note}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdHocForm(false)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={handleAddAdHoc}
                disabled={adHocLoading || !adHocLabel.trim()}
                className="cursor-pointer rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {copy.add}
              </button>
            </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdHocForm(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-1 py-1 text-sm text-gray-500 transition-colors hover:text-orange-600"
            >
              <span className="text-lg leading-none">+</span>
              {copy.addTemporary}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
