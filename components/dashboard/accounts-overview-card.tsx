import Link from "next/link";
import type { Account, BalanceSnapshot } from "@/lib/types/database";

const PURPOSE_COLORS: Record<string, string> = {
  salary: "from-blue-50 to-blue-100 border-blue-200",
  fixed_expense: "from-purple-50 to-purple-100 border-purple-200",
  dating_fund: "from-pink-50 to-pink-100 border-pink-200",
  savings: "from-green-50 to-green-100 border-green-200",
  flexible: "from-yellow-50 to-yellow-100 border-yellow-200",
  housing_fund: "from-indigo-50 to-indigo-100 border-indigo-200",
};

const PURPOSE_TEXT: Record<string, string> = {
  salary: "text-blue-700",
  fixed_expense: "text-purple-700",
  dating_fund: "text-pink-700",
  savings: "text-green-700",
  flexible: "text-yellow-700",
  housing_fund: "text-indigo-700",
};

interface AccountsOverviewCardProps {
  accounts: Account[];
  latestSnapshots: Map<string, BalanceSnapshot>;
}

export function AccountsOverviewCard({
  accounts,
  latestSnapshots,
}: AccountsOverviewCardProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        请先在
        <Link href="/settings" className="font-medium text-orange-500">
          设置
        </Link>
        中添加账户
      </div>
    );
  }

  // 计算总资产
  let totalAssets = 0;
  for (const account of accounts) {
    const snap = latestSnapshots.get(account.id);
    if (snap) totalAssets += snap.balance;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 px-5 py-3">
        <span className="text-sm font-medium text-amber-800">总资产</span>
        <span className="text-xl font-bold tabular-nums text-amber-900">
          ¥{totalAssets.toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {accounts.map((account) => {
        const snap = latestSnapshots.get(account.id);
        const colors =
          PURPOSE_COLORS[account.purpose] || "from-gray-50 to-gray-100 border-gray-200";
        const textColor = PURPOSE_TEXT[account.purpose] || "text-gray-700";

        return (
          <Link
            key={account.id}
            href="/balances"
            className={`cursor-pointer rounded-xl border bg-linear-to-br p-4 transition-shadow hover:shadow-md ${colors}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-lg">{account.icon}</span>
              <span className="truncate text-xs font-medium text-gray-600">
                {account.name}
              </span>
            </div>
            <p className={`mt-2 text-lg font-bold tabular-nums ${textColor}`}>
              {snap ? `¥${snap.balance.toLocaleString()}` : "—"}
            </p>
          </Link>
        );
      })}
      </div>
    </div>
  );
}
