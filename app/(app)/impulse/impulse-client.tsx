"use client";

import { useState } from "react";
import type { ImpulseLog } from "@/lib/types/database";
import { SavingsCounter } from "@/components/impulse/savings-counter";
import { ImpulseForm } from "@/components/impulse/impulse-form";
import { ImpulseList } from "@/components/impulse/impulse-list";

interface ImpulsePageClientProps {
  initialLogs: ImpulseLog[];
  initialTotal: number;
}

export function ImpulsePageClient({
  initialLogs,
  initialTotal,
}: ImpulsePageClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);

  function handleAdded(log: ImpulseLog) {
    setLogs((prev) => [log, ...prev]);
    setTotal((prev) => prev + log.estimated_price);
  }

  function handleDeleted(id: string) {
    const deleted = logs.find((l) => l.id === id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (deleted) {
      setTotal((prev) => prev - deleted.estimated_price);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">冲动拦截</h1>
        <p className="mt-1 text-sm text-gray-500">
          每一次忍住，都是对未来的投资
        </p>
      </div>

      <SavingsCounter total={total} />
      <ImpulseForm onAdded={handleAdded} />
      <ImpulseList logs={logs} onDeleted={handleDeleted} />
    </div>
  );
}
