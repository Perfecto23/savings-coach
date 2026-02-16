import type { MonthlyReportData } from "@/lib/report-generator";

interface MonthlyReportProps {
  data: MonthlyReportData;
}

export function MonthlyReport({ data }: MonthlyReportProps) {
  return (
    <div className="space-y-6">
      {/* 总览卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="SOP 完成率"
          value={`${data.sopCompletionRate}%`}
          color={data.sopCompletionRate === 100 ? "green" : "orange"}
        />
        <StatCard
          label="计划存入"
          value={
            data.milestone
              ? `¥${data.milestone.planned_savings.toLocaleString()}`
              : "—"
          }
          color="blue"
        />
        <StatCard
          label="实际存入"
          value={
            data.milestone?.actual_savings != null
              ? `¥${data.milestone.actual_savings.toLocaleString()}`
              : "—"
          }
          color={
            data.milestone?.actual_savings != null &&
            data.milestone.actual_savings >= data.milestone.planned_savings
              ? "green"
              : "red"
          }
        />
        <StatCard
          label="冲动拦截"
          value={`¥${data.impulseTotal.toLocaleString()}`}
          subtitle={`${data.impulseCount} 次`}
          color="purple"
        />
      </div>

      {/* SOP 执行详情 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">SOP 执行详情</h3>
        <div className="mt-3 space-y-2">
          {data.sopRecords.length === 0 ? (
            <p className="text-sm text-gray-400">本月无 SOP 记录</p>
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
                        ? "text-gray-900"
                        : "text-gray-400 line-through"
                    }`}
                  >
                    {record.step_label}
                  </span>
                </div>
                <span className="font-mono text-sm text-gray-500">
                  {record.amount != null
                    ? `¥${record.amount.toLocaleString()}`
                    : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 账户余额变化 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900">账户余额变化</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  账户
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  月初
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  月末
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  变化
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
                      ? `¥${startBalance.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600">
                    {endBalance != null
                      ? `¥${endBalance.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {change != null ? (
                      <span
                        className={change >= 0 ? "text-green-600" : "text-red-500"}
                      >
                        {change >= 0 ? "+" : ""}¥{change.toLocaleString()}
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
