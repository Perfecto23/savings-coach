import { formatMoney } from "@/lib/format-money";
import type { PlanPathPointDto } from "@/lib/plan/contracts";

function formatMonth(yearMonth: string, locale: string) {
  const date = new Date(`${yearMonth}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function PlanPath({
  points,
  locale,
  baseCurrency,
}: {
  points: PlanPathPointDto[];
  locale: string;
  baseCurrency: string;
}) {
  return (
    <section aria-label="Plan Path" className="mt-12 sm:mt-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em] text-stone-950">
            Plan Path
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Twelve monthly target balances from your latest Balance Snapshot
            and planned transfers. This path is not a forecast.
          </p>
        </div>
        {points.length > 0 ? (
          <p className="text-sm font-medium tabular-nums text-stone-500">
            {points.length} months
          </p>
        ) : null}
      </div>

      {points.length === 0 ? (
        <div className="mt-6 border-y border-stone-200 py-8 text-sm leading-6 text-stone-500">
          Activate your Savings Plan to create the Plan Path.
        </div>
      ) : (
        <ol className="mt-6 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-2 xl:grid-cols-3">
          {points.map((point, index) => (
            <li key={point.yearMonth} className="min-w-0 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-stone-700">
                  {formatMonth(point.yearMonth, locale)}
                </p>
                {index === 0 ? (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-5 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-stone-950">
                {formatMoney(Number(point.targetBalance), locale, baseCurrency)}
              </p>
              <p className="mt-1 text-sm tabular-nums text-stone-500">
                {formatMoney(Number(point.plannedTransfer), locale, baseCurrency)} planned this month
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
