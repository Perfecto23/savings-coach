import { SopChecklist } from "@/components/sop/sop-checklist";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Account, SopRecord, SopTemplate } from "@/lib/types/database";
import { MonthSelector } from "./month-selector";

interface SopPageProps {
  searchParams: Promise<{ month?: string }>;
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function SopPage({ searchParams }: SopPageProps) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [recordsRes, templatesRes, accountsRes] = await Promise.all([
    supabase
      .from("sop_records")
      .select("id, year_month, template_id, step_key, step_label, due_day, completed, completed_at, amount, note, sort_order, counts_toward_milestone, milestone_amount, created_at")
      .eq("owner_id", user.id)
      .eq("year_month", yearMonth)
      .order("sort_order"),
    supabase
      .from("sop_templates")
      .select("id, step_key, step_label, due_day, from_account_id, to_account_id, default_amount, sort_order, is_active, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("sort_order"),
    supabase
      .from("accounts")
      .select("id, name, bank, purpose, icon, sort_order, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("sort_order"),
  ]);

  const records = (recordsRes.data || []) as SopRecord[];
  const templates = (templatesRes.data || []) as SopTemplate[];
  const accounts = (accountsRes.data || []) as Account[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">月度 SOP</h1>
          <p className="mt-1 text-sm text-gray-500">按步骤执行每月储蓄流程</p>
        </div>
        <MonthSelector currentMonth={yearMonth} />
      </div>

      <SopChecklist
        initialRecords={records}
        templates={templates}
        accounts={accounts}
        yearMonth={yearMonth}
      />
    </div>
  );
}
