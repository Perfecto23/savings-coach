-- ============================================
-- 储蓄教练 数据库 Schema
-- 单用户设计：无 user_id，登录仅作门禁
-- 所有配置（账户、SOP、收入）通过 UI 动态管理
-- ============================================

-- 1. 账户表（动态管理，支持银行卡 + 公积金等任意账户类型）
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bank text not null,
  purpose text not null check (purpose in (
    'salary', 'fixed_expense', 'dating_fund', 'savings', 'flexible', 'housing_fund'
  )),
  icon text default '🏦',
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 薪资配置表（税前月薪 + 扣除项，支持历史变更）
create table public.salary_configs (
  id uuid primary key default gen_random_uuid(),
  monthly_gross numeric(12,2) not null,            -- 税前月薪
  housing_fund_rate numeric(5,2) default 12.00,    -- 公积金缴存比例 (%)
  housing_fund_base numeric(12,2),                 -- 公积金缴存基数（默认 = 税前月薪）
  social_insurance numeric(12,2) default 0,        -- 社保个人月缴额（养老+医疗+失业）
  special_deductions numeric(12,2) default 0,      -- 专项附加扣除月额（租房/教育等）
  effective_from date not null,                     -- 生效起始月（如 2026-03-01）
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. 奖金事件表（签字费、年终奖、其他一次性收入）
create table public.bonus_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('signing_bonus', 'year_end_bonus', 'other')),
  label text not null,
  amount numeric(12,2) not null,                   -- 税前金额
  expected_date date not null,
  is_received boolean default false,
  actual_amount numeric(12,2),                     -- 实际到手金额
  target_account_id uuid references public.accounts(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

-- 4. 月度里程碑表（由系统根据收入配置自动生成，可手动调整）
create table public.monthly_milestones (
  id uuid primary key default gen_random_uuid(),
  year_month text not null unique,
  planned_savings numeric(12,2) not null default 0,
  planned_total_savings numeric(12,2) not null default 0,
  actual_savings numeric(12,2),
  actual_total_savings numeric(12,2),
  status text not null default 'pending' check (status in ('pending', 'on_track', 'exceeded', 'missed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. 余额快照表
create table public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  recorded_at date not null,
  balance numeric(12,2) not null,
  note text,
  created_at timestamptz default now(),
  unique(account_id, recorded_at)
);

-- 6. SOP 模板表（用户通过 UI 配置 SOP 步骤，引用账户 ID）
create table public.sop_templates (
  id uuid primary key default gen_random_uuid(),
  step_key text not null unique,                    -- 唯一标识如 'transfer_savings'
  step_label text not null,                         -- 显示文本如 '转账至储蓄账户'
  due_day int not null,                             -- 应完成日（1/10/28）
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  default_amount numeric(12,2),                     -- 默认金额
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. SOP 执行记录表（每月从模板实例化）
create table public.sop_records (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  template_id uuid references public.sop_templates(id) on delete set null,
  step_key text not null,
  step_label text not null,
  due_day int not null,
  completed boolean default false,
  completed_at timestamptz,
  amount numeric(12,2),
  note text,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique(year_month, step_key)
);

-- 8. AI 对话表
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  year_month text,
  title text not null,
  conversation_type text not null default 'review' check (conversation_type in ('review', 'advice', 'plan', 'general')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 9. AI 消息表
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now()
);

-- 10. AI 模型配置表
create table public.ai_configs (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  api_url text not null,
  api_key text not null,
  model_name text not null,
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 11. 冲动消费拦截记录表
create table public.impulse_logs (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  estimated_price numeric(12,2) not null,
  reason text,
  resisted boolean default true,
  logged_at date default current_date,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security
-- 策略：只要已登录就可以访问所有数据（单用户门禁模式）
-- ============================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'accounts', 'salary_configs', 'bonus_events', 'monthly_milestones',
      'balance_snapshots', 'sop_templates', 'sop_records',
      'ai_conversations', 'ai_messages', 'ai_configs', 'impulse_logs'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Authenticated access" on public.%I for all using (auth.uid() is not null) with check (auth.uid() is not null)',
      t
    );
  end loop;
end $$;

-- ============================================
-- updated_at 自动更新触发器
-- ============================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.update_updated_at();

create trigger salary_configs_updated_at before update on public.salary_configs
  for each row execute function public.update_updated_at();

create trigger monthly_milestones_updated_at before update on public.monthly_milestones
  for each row execute function public.update_updated_at();

create trigger sop_templates_updated_at before update on public.sop_templates
  for each row execute function public.update_updated_at();

create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.update_updated_at();

create trigger ai_configs_updated_at before update on public.ai_configs
  for each row execute function public.update_updated_at();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_account_date ON balance_snapshots(account_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_records_year_month ON sop_records(year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_milestones_year_month ON monthly_milestones(year_month);
CREATE INDEX IF NOT EXISTS idx_bonus_events_expected_date ON bonus_events(expected_date);
CREATE INDEX IF NOT EXISTS idx_impulse_logs_resisted ON impulse_logs(resisted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
