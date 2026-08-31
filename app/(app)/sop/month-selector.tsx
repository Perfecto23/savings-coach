"use client";

import { useRouter } from "next/navigation";

interface MonthSelectorProps {
  currentMonth: string;
  ariaLabel: string;
}

export function MonthSelector({ currentMonth, ariaLabel }: MonthSelectorProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    router.push(`/sop?month=${e.target.value}`);
  }

  return (
    <input
      type="month"
      value={currentMonth}
      onChange={handleChange}
      aria-label={ariaLabel}
      className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
    />
  );
}
