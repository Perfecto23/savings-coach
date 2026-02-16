export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalSavings: number;
  streak: number;
  impulseTotal: number;
  sopPerfectMonths: number;
  firstSaveCompleted: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_save",
    name: "第一桶金",
    description: "完成第一次储蓄记录",
    icon: "🪣",
    check: (s) => s.firstSaveCompleted,
  },
  {
    id: "streak_3",
    name: "三连胜",
    description: "连续3个月达标",
    icon: "🔥",
    check: (s) => s.streak >= 3,
  },
  {
    id: "streak_6",
    name: "半年不败",
    description: "连续6个月达标",
    icon: "⚡",
    check: (s) => s.streak >= 6,
  },
  {
    id: "impulse_1k",
    name: "理性消费者",
    description: "冲动拦截累计省下 ¥1,000",
    icon: "🛡️",
    check: (s) => s.impulseTotal >= 1000,
  },
  {
    id: "impulse_10k",
    name: "钢铁意志",
    description: "冲动拦截累计省下 ¥10,000",
    icon: "💎",
    check: (s) => s.impulseTotal >= 10000,
  },
  {
    id: "total_10w",
    name: "十万大关",
    description: "累计存款突破 ¥100,000",
    icon: "🏆",
    check: (s) => s.totalSavings >= 100000,
  },
  {
    id: "total_20w",
    name: "二十万里程碑",
    description: "累计存款突破 ¥200,000",
    icon: "🎯",
    check: (s) => s.totalSavings >= 200000,
  },
  {
    id: "sop_perfect",
    name: "完美执行",
    description: "至少一个月 SOP 全部完成",
    icon: "✅",
    check: (s) => s.sopPerfectMonths >= 1,
  },
];

export function getUnlockedAchievements(stats: AchievementStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

/** Impulse savings display thresholds for SavingsCounter. 1000/10000 align with impulse_1k/impulse_10k; 5000/50000 are intermediate milestones. */
export const IMPULSE_SAVINGS_THRESHOLDS = [
  { threshold: 1000, label: "理性消费者", icon: "🛡️" },
  { threshold: 5000, label: "省钱达人", icon: "⭐" },
  { threshold: 10000, label: "钢铁意志", icon: "💎" },
  { threshold: 50000, label: "储蓄守护者", icon: "🏆" },
] as const;
