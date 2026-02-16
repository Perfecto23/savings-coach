interface StreakCounterProps {
  count: number;
}

export function StreakCounter({ count }: StreakCounterProps) {
  if (count <= 0) return null;

  const intensity =
    count >= 6 ? "from-red-500 to-orange-500" :
    count >= 3 ? "from-orange-400 to-amber-400" :
    "from-amber-300 to-yellow-300";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-linear-to-r px-3 py-1 ${intensity}`}
    >
      <span className="text-sm">🔥</span>
      <span className="text-sm font-bold text-white">
        {count} 月连胜
      </span>
    </div>
  );
}
