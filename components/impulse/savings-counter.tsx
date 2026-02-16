import { IMPULSE_SAVINGS_THRESHOLDS } from "@/lib/achievements";

interface SavingsCounterProps {
  total: number;
}

export function SavingsCounter({ total }: SavingsCounterProps) {
  const earned = IMPULSE_SAVINGS_THRESHOLDS.filter((a) => total >= a.threshold);
  const next = IMPULSE_SAVINGS_THRESHOLDS.find((a) => total < a.threshold);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
      <p className="text-sm font-medium text-gray-500">累计省下</p>
      <p className="mt-2 text-4xl font-bold text-green-600">
        ¥{total.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-gray-400">忍住就是赚到！</p>

      {/* 成就徽章 */}
      {earned.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {earned.map((a) => (
            <span
              key={a.threshold}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
            >
              <span>{a.icon}</span>
              {a.label}
            </span>
          ))}
        </div>
      )}

      {/* 下一个目标 */}
      {next && (
        <div className="mt-3">
          <p className="text-xs text-gray-400">
            距离下一成就「{next.icon} {next.label}」还差{" "}
            <span className="font-medium text-orange-500">
              ¥{(next.threshold - total).toLocaleString()}
            </span>
          </p>
          <div className="mx-auto mt-1.5 h-1.5 max-w-48 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-400 to-orange-500 transition-all"
              style={{
                width: `${Math.min(100, (total / next.threshold) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
