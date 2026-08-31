import type { MonthlyReportData } from "@/lib/report-generator";
import { formatMoney } from "@/lib/format-money";
import type { MonthlyReportCopy } from "@/lib/monthly-review/presentation";

interface MonthlyReportProps {
  data: MonthlyReportData;
  locale: string;
  baseCurrency: string;
  copy: MonthlyReportCopy;
}

export function MonthlyReport({ data, locale, baseCurrency, copy }: MonthlyReportProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={copy.stats.executionCompletion}
          value={`${data.sopCompletionRate}%`}
          color={data.sopCompletionRate === 100 ? "green" : "orange"}
        />
        <StatCard
          label={copy.stats.plannedTransfer}
          value={
            data.milestone
              ? formatMoney(data.milestone.planned_savings, locale, baseCurrency)
              : "—"
          }
          color="blue"
        />
        <StatCard
          label={copy.stats.netValueChange}
          value={
            data.milestone?.actual_savings != null
              ? formatMoney(data.milestone.actual_savings, locale, baseCurrency)
              : "—"
          }
          color="blue"
        />
        <StatCard
          label={copy.stats.impulseAmount}
          value={formatMoney(data.impulseTotal, locale, baseCurrency)}
          subtitle={copy.stats.decisions.replace("{count}", String(data.impulseCount))}
          color="purple"
        />
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-700">
        {copy.explanation}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">{copy.actions.title}</h3>
        <div className="mt-3 space-y-2">
          {data.sopRecords.length === 0 ? (
            <p className="text-sm text-gray-400">{copy.actions.empty}</p>
          ) : (
            data.sopRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      record.completed ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      record.completed
                        ? "text-gray-500 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {record.step_label}
                  </span>
                </div>
                <span className="font-mono text-sm text-gray-500">
                  {record.amount != null
                    ? formatMoney(record.amount, locale, baseCurrency)
                    : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">{copy.balances.title}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  {copy.balances.account}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {copy.balances.earliest}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {copy.balances.latest}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {copy.balances.observedChange}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.accountBalances.map(({ account, startBalance, endBalance, change }) => (
                <tr key={account.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2">
                    <span className="mr-1">{account.icon}</span>
                    {account.name}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {startBalance != null
                      ? formatMoney(startBalance, locale, baseCurrency)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {endBalance != null
                      ? formatMoney(endBalance, locale, baseCurrency)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {change != null ? (
                      <span className="text-stone-700">
                        {change >= 0 ? "+" : ""}
                        {formatMoney(change, locale, baseCurrency)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  color: "green" | "orange" | "blue" | "red" | "purple";
}) {
  const colorClasses = {
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className={`rounded-xl p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
    </div>
  );
}
