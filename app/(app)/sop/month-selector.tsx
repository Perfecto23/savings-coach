"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface MonthSelectorProps {
  currentMonth: string;
  ariaLabel: string;
}

export function MonthSelector({ currentMonth, ariaLabel }: MonthSelectorProps) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    const monthNumber = match ? Number(match[2]) : 0;
    if (!match || monthNumber < 1 || monthNumber > 12) {
      setError("请输入 YYYY-MM 格式的有效月份。");
      return;
    }
    setError(null);
    router.push(`/sop?month=${month}`);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2" noValidate>
        <label htmlFor="sop-month" className="sr-only">
          {ariaLabel}
        </label>
        <input
          id="sop-month"
          type="text"
          inputMode="numeric"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          placeholder="YYYY-MM"
          maxLength={7}
          aria-invalid={error !== null}
          aria-describedby={error ? "sop-month-error" : undefined}
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="submit"
          className="min-h-10 cursor-pointer rounded-lg bg-orange-600 px-3 text-sm font-medium text-white transition-colors hover:bg-orange-700"
        >
          查看
        </button>
      </form>
      {error ? (
        <p id="sop-month-error" role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
