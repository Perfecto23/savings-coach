import type { Achievement } from "@/lib/achievements";

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
}

export function AchievementBadge({ achievement, unlocked }: AchievementBadgeProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
        unlocked
          ? "border-amber-200 bg-amber-50 shadow-sm"
          : "border-gray-100 bg-gray-50 opacity-40 grayscale"
      }`}
    >
      <span className="text-2xl">{achievement.icon}</span>
      <span
        className={`text-xs font-semibold ${
          unlocked ? "text-amber-800" : "text-gray-400"
        }`}
      >
        {achievement.name}
      </span>
      <span className="text-[10px] leading-tight text-gray-500">
        {achievement.description}
      </span>
    </div>
  );
}
