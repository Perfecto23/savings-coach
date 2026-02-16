import { createClient } from "@/lib/supabase/server";
import { SavingsProgressCard } from "@/components/dashboard/savings-progress-card";
import { AccountsOverviewCard } from "@/components/dashboard/accounts-overview-card";
import { CurrentMonthCard } from "@/components/dashboard/current-month-card";
import { UpcomingIncomeCard } from "@/components/dashboard/upcoming-income-card";
import { ImpulseSavingsCard } from "@/components/dashboard/impulse-savings-card";
import { AchievementBadge } from "@/components/ui/achievement-badge";
import { ACHIEVEMENTS, getUnlockedAchievements } from "@/lib/achievements";
import type {
  Account,
  BalanceSnapshot,
  MonthlyMilestone,
  SopRecord,
  BonusEvent,
  ImpulseLog,
} from "@/lib/types/database";

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = Date.now();
  const yearMonth = getCurrentYearMonth();

  const [
    accountsRes,
    snapshotsRes,
    milestonesRes,
    sopRes,
    sopAllRes,
    bonusRes,
    impulseRes,
    impulseTotalRes,
  ] = await Promise.all([
    supabase.from("accounts").select("*").order("sort_order"),
    supabase
      .from("balance_snapshots")
      .select("*")
      .order("recorded_at", { ascending: false }),
    supabase.from("monthly_milestones").select("*").order("year_month"),
    supabase
      .from("sop_records")
      .select("*")
      .eq("year_month", yearMonth)
      .order("sort_order"),
    supabase.from("sop_records").select("year_month, completed").order("year_month"),
    supabase
      .from("bonus_events")
      .select("*")
      .order("expected_date"),
    supabase
      .from("impulse_logs")
      .select("*")
      .eq("resisted", true)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("impulse_logs")
      .select("estimated_price")
      .eq("resisted", true),
  ]);

  const accounts = (accountsRes.data || []) as Account[];
  const snapshots = (snapshotsRes.data || []) as BalanceSnapshot[];
  const milestones = (milestonesRes.data || []) as MonthlyMilestone[];
  const sopRecords = (sopRes.data || []) as SopRecord[];
  const sopAllRecords = (sopAllRes.data || []) as { year_month: string; completed: boolean }[];
  const bonusEvents = (bonusRes.data || []) as BonusEvent[];
  const impulseLogs = (impulseRes.data || []) as ImpulseLog[];

  // 每个账户最新余额
  const latestSnapshots = new Map<string, BalanceSnapshot>();
  for (const snap of snapshots) {
    if (!latestSnapshots.has(snap.account_id)) {
      latestSnapshots.set(snap.account_id, snap);
    }
  }

  // 储蓄账户总余额
  const savingsAccounts = accounts.filter((a) => a.purpose === "savings");
  let totalSavings = 0;
  for (const sa of savingsAccounts) {
    const snap = latestSnapshots.get(sa.id);
    if (snap) totalSavings += snap.balance;
  }

  // 当月里程碑
  const currentMilestone = milestones.find((m) => m.year_month === yearMonth) ?? null;

  // 冲动拦截总额
  const impulseTotal = (impulseTotalRes.data || []).reduce(
    (sum: number, row: { estimated_price: number }) => sum + row.estimated_price,
    0
  );

  // 连胜月数
  let streak = 0;
  const sortedMilestones = [...milestones].sort((a, b) =>
    b.year_month.localeCompare(a.year_month)
  );
  for (const m of sortedMilestones) {
    if (m.status === "on_track" || m.status === "exceeded") {
      streak++;
    } else if (m.status === "missed") {
      break;
    }
  }

  // SOP 完美月数（该月所有记录均完成）
  const sopByMonth = sopAllRecords.reduce(
    (acc, r) => {
      if (!acc[r.year_month]) acc[r.year_month] = { total: 0, completed: 0 };
      acc[r.year_month].total++;
      if (r.completed) acc[r.year_month].completed++;
      return acc;
    },
    {} as Record<string, { total: number; completed: number }>
  );
  const sopPerfectMonths = Object.values(sopByMonth).filter(
    (v) => v.total > 0 && v.total === v.completed
  ).length;

  const achievementStats = {
    totalSavings,
    streak,
    impulseTotal,
    sopPerfectMonths,
    firstSaveCompleted: totalSavings > 0 || sopAllRecords.some((r) => r.completed),
  };
  const unlocked = getUnlockedAchievements(achievementStats);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        <p className="mt-1 text-sm text-gray-500">你的储蓄旅程一览</p>
      </div>

      {/* 第一行：储蓄进度 */}
      <SavingsProgressCard
        milestones={milestones}
        totalSavings={totalSavings}
      />

      {/* 第二行：账户概览 */}
      <AccountsOverviewCard
        accounts={accounts}
        latestSnapshots={latestSnapshots}
      />

      {/* 第三行：本月状态 + 即将到账 + 冲动拦截 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CurrentMonthCard
          sopRecords={sopRecords}
          milestone={currentMilestone}
        />
        <UpcomingIncomeCard bonusEvents={bonusEvents} now={now} />
        <ImpulseSavingsCard logs={impulseLogs} totalSaved={impulseTotal} />
      </div>

      {/* 成就徽章 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">成就</h3>
        <p className="mt-1 text-sm text-gray-500">
          解锁成就，记录你的储蓄旅程
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACHIEVEMENTS.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              unlocked={unlocked.some((a) => a.id === achievement.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
