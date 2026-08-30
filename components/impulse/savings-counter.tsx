import { formatMoney } from "@/lib/format-money";

interface SavingsCounterProps {
  total: number;
  locale: string;
  baseCurrency: string;
}

export function SavingsCounter({
  total,
  locale,
  baseCurrency,
}: SavingsCounterProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
      <p className="text-sm font-medium text-gray-500">Impulse amount</p>
      <p className="mt-2 text-4xl font-bold text-green-600">
        {formatMoney(total, locale, baseCurrency)}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Estimated price of purchases you decided not to make. It is not confirmed savings.
      </p>
    </div>
  );
}
