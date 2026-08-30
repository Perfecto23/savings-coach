export interface SopDisplayRecord {
  id: string;
  year_month: string;
  step_label: string;
  due_day: number;
  completed: boolean;
  completed_at: string | null;
  amount: number | null;
  note: string | null;
  scheduled_for: string | null;
  source_account_name: string | null;
  target_account_name: string | null;
  is_ad_hoc: boolean;
}
