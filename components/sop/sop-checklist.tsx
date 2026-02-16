"use client";

import { useState, useEffect } from "react";
import type { Account, SopRecord, SopTemplate } from "@/lib/types/database";
import { SopStepItem } from "./sop-step-item";
import { initMonthSop, addAdHocSopStep } from "@/app/(app)/sop/actions";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Confetti } from "@/components/ui/confetti";

interface SopChecklistProps {
  initialRecords: SopRecord[];
  templates: SopTemplate[];
  accounts: Account[];
  yearMonth: string;
}

export function SopChecklist({
  initialRecords,
  templates,
  accounts,
  yearMonth,
}: SopChecklistProps) {
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [initDone, setInitDone] = useState(initialRecords.length > 0);
  const [showAdHocForm, setShowAdHocForm] = useState(false);
  const [adHocLabel, setAdHocLabel] = useState("");
  const [adHocDay, setAdHocDay] = useState("10");
  const [adHocAmount, setAdHocAmount] = useState("");
  const [adHocNote, setAdHocNote] = useState("");
  const [adHocLoading, setAdHocLoading] = useState(false);

  useEffect(() => {
    if (initDone) return;
    let cancelled = false;
    async function doInit() {
      setLoading(true);
      const result = await initMonthSop(yearMonth);
      if (!cancelled && result.success) {
        setRecords(result.data);
      }
      if (!cancelled) {
        setLoading(false);
        setInitDone(true);
      }
    }
    doInit();
    return () => { cancelled = true; };
  }, [initDone, yearMonth]);

  function getTemplateAccount(templateId: string | null, field: "from" | "to") {
    if (!templateId) return null;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return null;
    const accountId = field === "from" ? tpl.from_account_id : tpl.to_account_id;
    if (!accountId) return null;
    return accounts.find((a) => a.id === accountId) ?? null;
  }

  function handleRecordUpdated(updated: SopRecord) {
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
    }
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
    {} as Record<number, SopRecord[]>
  );

  const sortedDays = Object.keys(groups)
    .map(Number)
    .toSorted((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          还没有 SOP 模板，请先去
          <a href="/settings" className="font-medium text-orange-500 hover:text-orange-600">
            设置页
          </a>
          配置。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Confetti active={showCelebration} duration={3000} />

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
            <p className="font-medium text-gray-700">本月进度</p>
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
            本月 SOP 全部完成！
          </p>
          <p className="mt-1 text-sm text-green-600">太棒了，继续保持！</p>
        </div>
      )}

      {/* 按日期分组的步骤 */}
      {sortedDays.map((day) => (
        <div key={day}>
          <h3 className="mb-3 text-sm font-semibold text-gray-500">
            每月 {day} 号
          </h3>
          <div className="space-y-2">
            {groups[day].map((record) => (
              <SopStepItem
                key={record.id}
                record={record}
                accounts={accounts}
                templateFromAccount={getTemplateAccount(record.template_id, "from")}
                templateToAccount={getTemplateAccount(record.template_id, "to")}
                onUpdated={handleRecordUpdated}
                onDeleted={handleRecordDeleted}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 添加临时步骤 */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
        {showAdHocForm ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">添加临时操作</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={adHocLabel}
                onChange={(e) => setAdHocLabel(e.target.value)}
                placeholder="操作名称（如：储蓄→工资卡 匀钱）"
                aria-label="临时操作名称"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={adHocDay}
                  onChange={(e) => setAdHocDay(e.target.value)}
                  placeholder="执行日"
                  aria-label="执行日"
                  min={1}
                  max={31}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={adHocAmount}
                  onChange={(e) => setAdHocAmount(e.target.value)}
                  placeholder="金额（选填）"
                  aria-label="金额"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
            <input
              type="text"
              value={adHocNote}
              onChange={(e) => setAdHocNote(e.target.value)}
              placeholder="备注（选填）"
              aria-label="备注"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdHocForm(false)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddAdHoc}
                disabled={adHocLoading || !adHocLabel.trim()}
                className="cursor-pointer rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                添加
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
            添加临时操作（账户间匀钱等）
          </button>
        )}
      </div>
    </div>
  );
}
