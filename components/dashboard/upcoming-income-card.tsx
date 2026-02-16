import type { BonusEvent } from "@/lib/types/database";

interface UpcomingIncomeCardProps {
  bonusEvents: BonusEvent[];
  now: number;
}

export function UpcomingIncomeCard({ bonusEvents, now }: UpcomingIncomeCardProps) {
  const todayStr = new Date(now).toISOString().split("T")[0];
  const upcoming = bonusEvents
    .filter((e) => !e.is_received && e.expected_date >= todayStr)
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-500">即将到账</h3>

      <div className="mt-3 space-y-3">
        {upcoming.map((event) => {
          const daysUntil = Math.ceil(
            (new Date(event.expected_date).getTime() - now) /
              (1000 * 60 * 60 * 24)
          );

          return (
            <div key={event.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{event.label}</p>
                <p className="text-xs text-gray-500">{event.expected_date}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-gray-700">
                  ¥{event.amount.toLocaleString()}
                </p>
                <p className="text-xs font-medium text-orange-500">
                  {daysUntil} 天后
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
