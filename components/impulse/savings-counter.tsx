import { formatMoney } from "@/lib/format-money";
import type { ImpulseCopy } from "@/lib/impulse/presentation";

interface SavingsCounterProps {
  total: number;
  locale: string;
  baseCurrency: string;
  copy: ImpulseCopy["counter"];
}

export function SavingsCounter({
  total,
  locale,
  baseCurrency,
  copy,
}: SavingsCounterProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
      <p className="text-sm font-medium text-gray-500">{copy.label}</p>
      <p className="mt-2 text-4xl font-bold text-green-600">
        {formatMoney(total, locale, baseCurrency)}
      </p>
      <p className="mt-1 text-xs text-gray-400">{copy.description}</p>
    </div>
  );
}
