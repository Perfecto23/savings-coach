import type { Account, BalanceSnapshot } from "@/lib/types/database";

const PURPOSE_COLORS: Record<string, string> = {
  salary: "border-blue-200 bg-blue-50",
  fixed_expense: "border-purple-200 bg-purple-50",
  dating_fund: "border-pink-200 bg-pink-50",
  savings: "border-green-200 bg-green-50",
  flexible: "border-yellow-200 bg-yellow-50",
  housing_fund: "border-indigo-200 bg-indigo-50",
};

const PURPOSE_TEXT_COLORS: Record<string, string> = {
  salary: "text-blue-700",
  fixed_expense: "text-purple-700",
  dating_fund: "text-pink-700",
  savings: "text-green-700",
  flexible: "text-yellow-700",
  housing_fund: "text-indigo-700",
};

interface AccountBalanceCardProps {
  account: Account;
  latestSnapshot: BalanceSnapshot | null;
}

export function AccountBalanceCard({
  account,
  latestSnapshot,
}: AccountBalanceCardProps) {
  const colorClass = PURPOSE_COLORS[account.purpose] || "border-gray-200 bg-gray-50";
  const textColor = PURPOSE_TEXT_COLORS[account.purpose] || "text-gray-700";

  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{account.icon}</span>
        <span className="text-sm font-medium text-gray-700">{account.name}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${textColor}`}>
        {latestSnapshot
          ? `¥${latestSnapshot.balance.toLocaleString()}`
          : "—"}
      </div>
      {latestSnapshot && (
        <p className="mt-1 text-xs text-gray-400">
          更新于 {latestSnapshot.recorded_at}
        </p>
      )}
    </div>
  );
}
