"use client";

import { useState } from "react";
import type { ImpulseLog } from "@/lib/types/database";
import { SavingsCounter } from "@/components/impulse/savings-counter";
import { ImpulseForm } from "@/components/impulse/impulse-form";
import { ImpulseList } from "@/components/impulse/impulse-list";
import { getImpulseCopy } from "@/lib/impulse/presentation";

interface ImpulsePageClientProps {
  initialLogs: ImpulseLog[];
  initialTotal: number;
  locale: string;
  baseCurrency: string;
}

export function ImpulsePageClient({
  initialLogs,
  initialTotal,
  locale,
  baseCurrency,
}: ImpulsePageClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const copy = getImpulseCopy(locale);

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
    <section
      lang={locale}
      aria-labelledby="impulse-page-title"
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <h1 id="impulse-page-title" className="text-2xl font-bold text-gray-900">
          {copy.page.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{copy.page.description}</p>
      </div>

      <SavingsCounter
        total={total}
        locale={locale}
        baseCurrency={baseCurrency}
        copy={copy.counter}
      />
      <ImpulseForm
        baseCurrency={baseCurrency}
        copy={copy.form}
        locale={locale}
        onAdded={handleAdded}
      />
      <ImpulseList
        logs={logs}
        locale={locale}
        baseCurrency={baseCurrency}
        copy={copy.list}
        onDeleted={handleDeleted}
      />
    </section>
  );
}
