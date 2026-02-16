import Link from "next/link";
import type { ImpulseLog } from "@/lib/types/database";

interface ImpulseSavingsCardProps {
  logs: ImpulseLog[];
  totalSaved: number;
}

export function ImpulseSavingsCard({ logs, totalSaved }: ImpulseSavingsCardProps) {
  const recentLogs = logs.slice(0, 3);

  return (
    <Link
      href="/impulse"
      className="block cursor-pointer rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
    >
      <h3 className="text-sm font-semibold text-gray-500">冲动拦截</h3>

      <p className="mt-2 text-2xl font-bold text-green-600">
        ¥{totalSaved.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-gray-400">已省下</span>
      </p>

      {recentLogs.length > 0 && (
        <div className="mt-3 space-y-1">
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{log.item_name}</span>
              <span className="font-mono text-gray-400">
                ¥{log.estimated_price.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
