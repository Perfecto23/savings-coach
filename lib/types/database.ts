// 单用户设计：所有表无 user_id 字段
// 所有配置（账户、SOP、收入）通过 UI 动态管理

export type AccountPurpose =
  | "salary"
  | "fixed_expense"
  | "dating_fund"
  | "savings"
  | "flexible"
  | "housing_fund";

export interface Account {
  id: string;
  name: string;
  bank: string;
  purpose: AccountPurpose;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SalaryConfig {
  id: string;
  monthly_gross: number;
  housing_fund_rate: number;
  housing_fund_base: number | null;
  social_insurance: number;
  special_deductions: number;
  effective_from: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type BonusType = "signing_bonus" | "year_end_bonus" | "other";

export interface BonusEvent {
  id: string;
  type: BonusType;
  label: string;
  amount: number;
  expected_date: string;
  is_received: boolean;
  actual_amount: number | null;
  target_account_id: string | null;
  note: string | null;
  created_at: string;
}

export interface MonthlyMilestone {
  id: string;
  year_month: string;
  planned_savings: number;
  planned_total_savings: number;
  actual_savings: number | null;
  actual_total_savings: number | null;
  status: "pending" | "on_track" | "exceeded" | "missed";
  created_at: string;
  updated_at: string;
}

export interface BalanceSnapshot {
  id: string;
  account_id: string;
  recorded_at: string;
  balance: number;
  note: string | null;
  created_at: string;
}

export interface SopTemplate {
  id: string;
  step_key: string;
  step_label: string;
  due_day: number;
  from_account_id: string | null;
  to_account_id: string | null;
  default_amount: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SopRecord {
  id: string;
  year_month: string;
  template_id: string | null;
  step_key: string;
  step_label: string;
  due_day: number;
  completed: boolean;
  completed_at: string | null;
  amount: number | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface AiConversation {
  id: string;
  year_month: string | null;
  title: string;
  conversation_type: "review" | "advice" | "plan" | "general";
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface AiConfig {
  id: string;
  provider_name: string;
  api_url: string;
  api_key: string;
  model_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImpulseLog {
  id: string;
  item_name: string;
  estimated_price: number;
  reason: string | null;
  resisted: boolean;
  logged_at: string;
  created_at: string;
}

// ============================================
// 计算型（非持久化）
// ============================================

/** 某月的税后工资计算结果 */
export interface MonthlyNetIncome {
  month: string;                  // "2026-03"
  gross: number;                  // 税前
  social_insurance: number;       // 社保个人
  housing_fund: number;           // 公积金个人
  taxable_income: number;         // 应纳税所得额
  tax: number;                    // 当月个税
  net: number;                    // 到手
  housing_fund_company: number;   // 公司缴存公积金（可选展示）
}

// ============================================
// Server Action 统一返回类型
// ============================================

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
