import type { BonusEvent } from "@/lib/types/database";

const TYPE_ICONS: Record<string, string> = {
  signing_bonus: "✍️",
  year_end_bonus: "🎉",
  other: "💵",
};

interface IncomeTimelineProps {
  bonusEvents: BonusEvent[];
  now: number;
}

export function IncomeTimeline({ bonusEvents, now }: IncomeTimelineProps) {
  if (bonusEvents.length === 0) {
    return null;
  }

  const today = new Date(now).toISOString().split("T")[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">收入时间线</h3>
      <p className="mt-1 text-sm text-gray-500">未来所有收入事件</p>

      <div className="mt-4 space-y-0">
        {bonusEvents.map((event, index) => {
          const isPast = event.expected_date < today;
          const daysUntil = Math.ceil(
            (new Date(event.expected_date).getTime() - now) /
              (1000 * 60 * 60 * 24)
          );

          return (
            <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {index < bonusEvents.length - 1 && (
                <div className="absolute left-3.75 top-8 h-full w-0.5 bg-gray-200" />
              )}

              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                  event.is_received
                    ? "bg-green-100"
                    : isPast
                      ? "bg-gray-100"
                      : "bg-orange-100"
                }`}
              >
                {event.is_received ? "✓" : TYPE_ICONS[event.type] || "💵"}
              </div>

              <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{event.label}</span>
                  <span className="font-mono text-sm font-semibold text-gray-700">
                    ¥{(event.actual_amount ?? event.amount).toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <span>{event.expected_date}</span>
                  {event.is_received ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
                      已到账
                    </span>
                  ) : daysUntil > 0 ? (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-600">
                      还有 {daysUntil} 天
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                      已过期
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
