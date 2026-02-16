"use client";

import { useMemo } from "react";
import type { MonthlyBreakdown } from "@/lib/tax-calculator";
import type { BonusEvent } from "@/lib/types/database";

interface MonthlyForecastTableProps {
  breakdown: MonthlyBreakdown[];
  bonusEvents: BonusEvent[];
  startYear: number;
}

export function MonthlyForecastTable({
  breakdown,
  bonusEvents,
  startYear,
}: MonthlyForecastTableProps) {
  const cumulativeFunds = useMemo(
    () =>
      breakdown.reduce<number[]>((acc, row) => {
        const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
        return [...acc, prev + row.housingFund + row.housingFundCompany];
      }, []),
    [breakdown],
  );

  function getBonusForMonth(month: number) {
    const yearMonth = `${startYear}-${String(month).padStart(2, "0")}`;
    return bonusEvents.filter((e) => e.expected_date.startsWith(yearMonth));
  }

  const totalCumulative = cumulativeFunds[cumulativeFunds.length - 1] ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">月度到手预测</h3>
      <p className="mt-1 text-sm text-gray-500">
        基于累计预扣法，年初个税低、年末高
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-175 text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left font-medium text-gray-500">月份</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">税前</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">社保</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">公积金</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">个税</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">到手</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">公积金累计</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">奖金</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row, index) => {
              const bonuses = getBonusForMonth(row.month);

              return (
                <tr
                  key={row.month}
                  className={`border-b border-gray-50 last:border-0 ${
                    bonuses.length > 0 ? "bg-amber-50/50" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {row.month}月
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">
                    {row.gross.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">
                    -{row.socialInsurance.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">
                    -{row.housingFund.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-red-500">
                    -{row.monthlyTax.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">
                    {row.netIncome.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-blue-600">
                    {cumulativeFunds[index].toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {bonuses.map((b) => (
                      <span
                        key={b.id}
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.is_received
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        +¥{(b.actual_amount ?? b.amount).toLocaleString()}
                        {b.is_received ? " ✓" : ""}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50/50">
              <td className="px-3 py-2 font-semibold text-gray-900">合计</td>
              <td className="px-3 py-2 text-right font-mono font-semibold">
                {breakdown.reduce((s, r) => s + r.gross, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">
                -{breakdown.reduce((s, r) => s + r.socialInsurance, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-500">
                -{breakdown.reduce((s, r) => s + r.housingFund, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-red-500">
                -{breakdown.reduce((s, r) => s + r.monthlyTax, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">
                {breakdown.reduce((s, r) => s + r.netIncome, 0).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-blue-600">
                {totalCumulative.toLocaleString()}
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
