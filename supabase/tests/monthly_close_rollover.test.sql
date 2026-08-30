begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

select has_column(
  'public',
  'monthly_milestones',
  'review_completed_at',
  'Monthly Review completion is stored on its Monthly Milestone'
);

select has_function(
  'public',
  'close_monthly_review',
  array['text'],
  'close_monthly_review(text) is the atomic close and rollover seam'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'close_monthly_review'
      and procedure.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
        where setting like 'search_path=%'
      )
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
      and not exists (
        select 1
        from unnest(coalesce(procedure.proargnames, array[]::text[])) as argument_name
        where argument_name in ('owner_id', 'p_owner_id')
      )
  ),
  1::bigint,
  'Monthly Close is an authenticated owner-derived definer seam'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'monthly_reviews', 'monthly_closes', 'rollovers', 'review_events'
      )
  ),
  0::bigint,
  'Monthly Close adds no review, close, rollover, or event table'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-00000000008a',
    'authenticated', 'authenticated', 'close-a@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-00000000008b',
    'authenticated', 'authenticated', 'close-b@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.accounts (id, owner_id, name, bank, purpose)
values
  ('10000000-0000-4000-8000-00000000008a', '00000000-0000-4000-8000-00000000008a', 'A Savings', null, 'savings'),
  ('11000000-0000-4000-8000-00000000008a', '00000000-0000-4000-8000-00000000008a', 'A Source', null, 'salary'),
  ('10000000-0000-4000-8000-00000000008b', '00000000-0000-4000-8000-00000000008b', 'B Savings', null, 'savings');

insert into public.owner_setup (
  owner_id, locale, time_zone, base_currency, savings_account_id,
  plan_activated_at
) values
  ('00000000-0000-4000-8000-00000000008a', 'en-SG', 'Asia/Singapore', 'SGD', '10000000-0000-4000-8000-00000000008a', now() - interval '2 months'),
  ('00000000-0000-4000-8000-00000000008b', 'en-US', 'America/New_York', 'USD', '10000000-0000-4000-8000-00000000008b', now() - interval '2 months');

insert into public.balance_snapshots (account_id, recorded_at, balance)
values
  ('10000000-0000-4000-8000-00000000008a', (current_timestamp at time zone 'Asia/Singapore')::date, 1000),
  ('10000000-0000-4000-8000-00000000008b', (current_timestamp at time zone 'America/New_York')::date, 2000);

insert into public.sop_templates (
  id, owner_id, step_key, step_label, due_day,
  from_account_id, to_account_id, default_amount,
  sort_order, is_active, is_plan_rule
) values
  ('20000000-0000-4000-8000-00000000008a', '00000000-0000-4000-8000-00000000008a', 'a_monthly_rule', 'A Monthly Rule', 31, '11000000-0000-4000-8000-00000000008a', '10000000-0000-4000-8000-00000000008a', 100, 1, true, true),
  ('20000000-0000-4000-8000-00000000008b', '00000000-0000-4000-8000-00000000008b', 'b_monthly_rule', 'B Monthly Rule', 15, null, '10000000-0000-4000-8000-00000000008b', 200, 1, true, true),
  ('21000000-0000-4000-8000-00000000008a', '00000000-0000-4000-8000-00000000008a', 'a_legacy_template', 'A Legacy Template', 5, '11000000-0000-4000-8000-00000000008a', '10000000-0000-4000-8000-00000000008a', 10, 50, true, false);

insert into public.monthly_milestones (
  owner_id, year_month, planned_savings, planned_total_savings,
  status, is_plan_path
) values
  ('00000000-0000-4000-8000-00000000008a', to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'), 100, 1100, 'pending', true),
  ('00000000-0000-4000-8000-00000000008a', to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM'), 100, 1200, 'pending', true),
  ('00000000-0000-4000-8000-00000000008b', to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM'), 200, 2200, 'pending', true),
  ('00000000-0000-4000-8000-00000000008b', to_char(date_trunc('month', current_timestamp at time zone 'America/New_York'), 'YYYY-MM'), 200, 2400, 'pending', true);

insert into public.sop_records (
  id, owner_id, year_month, template_id, step_key, step_label,
  due_day, completed, completed_at, amount, sort_order,
  counts_toward_milestone, milestone_amount, is_monthly_action,
  rule_amount, scheduled_for, source_account_id, source_account_name,
  target_account_id, target_account_name
) values
  (
    '80000000-0000-4000-8000-00000000008a',
    '00000000-0000-4000-8000-00000000008a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
    '20000000-0000-4000-8000-00000000008a',
    'a_monthly_rule', 'A Monthly Rule', 31, true, now(), 100, 1,
    true, 100, true, 100,
    public.plan_scheduled_date((date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month')::date, 31),
    '11000000-0000-4000-8000-00000000008a', 'A Source',
    '10000000-0000-4000-8000-00000000008a', 'A Savings'
  ),
  (
    '81000000-0000-4000-8000-00000000008a',
    '00000000-0000-4000-8000-00000000008a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
    null,
    'a_review_note', 'A Review note', 1, true, now(), null, 99,
    false, null, false, null, null, null, null, null, null
  ),
  (
    '82000000-0000-4000-8000-00000000008a',
    '00000000-0000-4000-8000-00000000008a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
    '21000000-0000-4000-8000-00000000008a',
    'a_legacy_template', 'A Legacy Template', 5, true, now(), 10, 50,
    false, null, false, null, null,
    '11000000-0000-4000-8000-00000000008a', null,
    '10000000-0000-4000-8000-00000000008a', null
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008a","role":"authenticated"}';

select is_empty(
  $$
    update public.monthly_milestones
    set review_completed_at = current_timestamp
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and is_plan_path
    returning id
  $$,
  'authenticated clients cannot spoof Monthly Review completion directly'
);

select throws_ok(
  $$ select public.close_monthly_review('2026-13') $$,
  'P0001', null,
  'Monthly Close rejects an invalid year-month'
);

select throws_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
    )
  $$,
  'P0001', null,
  'Monthly Close rejects the current owner-local month'
);

select throws_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '2 months', 'YYYY-MM')
    )
  $$,
  'P0001', null,
  'Monthly Close rejects a month older than the previous owner-local month'
);

select results_eq(
  $$
    select
      result.payload ->> 'reviewed_year_month',
      (result.payload ->> 'review_completed_at') is not null,
      result.payload ->> 'next_year_month',
      (result.payload ->> 'created_action_count')::integer,
      (result.payload ->> 'existing_action_count')::integer
    from (
      select public.close_monthly_review(
        to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
      ) as payload
    ) as result
  $$,
  $$
    values (
      to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
      true,
      to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM'),
      1,
      0
    )
  $$,
  'ready Monthly Review closes and creates the current Monthly Action atomically'
);

create temporary table first_review_completion as
select review_completed_at
from public.monthly_milestones
where owner_id = '00000000-0000-4000-8000-00000000008a'
  and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM');

select results_eq(
  $$
    select status, review_completed_at is not null, actual_total_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  $$ values ('on_track'::text, true, null::numeric) $$,
  'Monthly Review completion does not require a Balance Observation'
);

select results_eq(
  $$
    select
      step_label, amount, rule_amount, due_day, scheduled_for,
      source_account_name, target_account_name, completed
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
      and is_monthly_action
  $$,
  $$
    values (
      'A Monthly Rule'::text, 100.00::numeric, 100.00::numeric, 31,
      public.plan_scheduled_date(date_trunc('month', current_timestamp at time zone 'Asia/Singapore')::date, 31),
      'A Source'::text, 'A Savings'::text, false
    )
  $$,
  'rollover freezes current Monthly Action amount, schedule, and account names'
);

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and is_plan_path
      and year_month >= to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  ),
  12::bigint,
  'rollover rebuilds the current plus eleven-month Plan Path'
);

select results_eq(
  $$
    select distinct receipt_key
    from jsonb_object_keys(
      public.close_monthly_review(
        to_char(
          date_trunc('month', current_timestamp at time zone 'Asia/Singapore')
          - interval '1 month',
          'YYYY-MM'
        )
      )
    ) as receipt_key
    order by receipt_key
  $$,
  $$
    values
      ('created_action_count'::text),
      ('existing_action_count'::text),
      ('next_year_month'::text),
      ('review_completed_at'::text),
      ('reviewed_year_month'::text)
  $$,
  'Monthly Close receipt exposes only the safe field allowlist'
);

select results_eq(
  $$
    select
      (result.payload ->> 'created_action_count')::integer,
      (result.payload ->> 'existing_action_count')::integer,
      (result.payload ->> 'review_completed_at')::timestamptz
    from (
      select public.close_monthly_review(
        to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
      ) as payload
    ) as result
  $$,
  $$
    select 0, 1, review_completed_at
    from first_review_completion
  $$,
  'repeating Monthly Close returns the first timestamp without new actions'
);

select results_eq(
  $$
    select
      (
        select count(*)
        from public.sop_records
        where owner_id = '00000000-0000-4000-8000-00000000008a'
          and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
          and is_monthly_action
      ),
      review_completed_at
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  $$ select 1::bigint, review_completed_at from first_review_completion $$,
  'Monthly Close idempotency preserves one action and one completion timestamp'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008b","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.sop_records (
      owner_id, year_month, template_id, step_key, step_label,
      due_day, completed, is_monthly_action
    ) values (
      '00000000-0000-4000-8000-00000000008a',
      to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
      null, 'cross_owner_closed_write', 'Cross owner closed write',
      1, false, false
    )
  $$,
  'P0001', 'sop_owner_mismatch',
  'SOP trigger rejects caller and row owner mismatch before locking'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008a","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_monthly_action(
      '80000000-0000-4000-8000-00000000008a',
      '{"completed":false}'::jsonb
    )
  $$,
  'P0001', 'month_review_closed',
  'a closed Monthly Action cannot be reopened'
);

select throws_ok(
  $$
    insert into public.sop_records (
      owner_id, year_month, template_id, step_key, step_label, due_day,
      is_monthly_action
    ) values (
      '00000000-0000-4000-8000-00000000008a',
      to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
      null, 'late_review_note', 'Late Review note', 2, false
    )
  $$,
  'P0001', 'month_review_closed',
  'a closed month cannot receive a new SOP Record'
);

select throws_ok(
  $$
    update public.sop_records
    set note = 'changed'
    where id = '81000000-0000-4000-8000-00000000008a'
  $$,
  'P0001', 'month_review_closed',
  'a closed legacy SOP Record cannot be edited'
);

reset role;

select throws_ok(
  $$ delete from public.sop_records where id = '80000000-0000-4000-8000-00000000008a' $$,
  'P0001', 'month_review_closed',
  'a closed Monthly Action cannot be deleted below RLS'
);

select throws_ok(
  $$
    update public.monthly_milestones
    set planned_savings = 999, status = 'missed', is_plan_path = false
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  'P0001', 'month_review_closed',
  'closed planned fields, execution status, and path marker are immutable'
);

select throws_ok(
  $$
    update public.monthly_milestones
    set review_completed_at = review_completed_at + interval '1 second'
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  'P0001', 'month_review_closed',
  'Monthly Review completion timestamp is immutable'
);

select throws_ok(
  $$
    delete from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  'P0001', null,
  'a closed Monthly Milestone cannot be deleted'
);

select lives_ok(
  $$
    update public.monthly_milestones
    set actual_savings = 55, actual_total_savings = 1055
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  'closed Net Worth fields remain correctable'
);

select results_eq(
  $$
    select status, actual_savings, actual_total_savings, review_completed_at
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  $$ select 'on_track'::text, 55.00::numeric, 1055.00::numeric, review_completed_at from first_review_completion $$,
  'Net Worth correction preserves execution state and review completion'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_balance_observations(
      (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month' + interval '14 days')::date,
      '[{"account_id":"10000000-0000-4000-8000-00000000008a","balance":"500.00"}]'::jsonb
    )
  $$,
  'a closed month accepts a late Balance Observation'
);

select results_eq(
  $$
    select status, actual_total_savings, review_completed_at
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  $$ select 'on_track'::text, 500.00::numeric, review_completed_at from first_review_completion $$,
  'late Balance Observation changes Net Worth only'
);

select lives_ok(
  $$
    delete from public.sop_templates
    where id = '21000000-0000-4000-8000-00000000008a'
      and owner_id = '00000000-0000-4000-8000-00000000008a'
  $$,
  'closed legacy SOP history permits template-link cleanup'
);

select ok(
  (
    select template_id is null
      and step_label = 'A Legacy Template'
      and amount = 10
      and completed
    from public.sop_records
    where id = '82000000-0000-4000-8000-00000000008a'
  ),
  'legacy template deletion preserves the closed SOP execution snapshot'
);

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-00000000008a",
        "name":"A Monthly Rule edited",
        "amount":"200.00",
        "due_day":10,
        "source_account_id":"11000000-0000-4000-8000-00000000008a",
        "target_account_id":"10000000-0000-4000-8000-00000000008a"
      }'::jsonb
    )
  $$,
  'Plan Rule remains editable after rollover'
);

select results_eq(
  $$
    select step_label, amount, rule_amount, due_day
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
      and is_monthly_action
  $$,
  $$ values ('A Monthly Rule'::text, 100.00::numeric, 100.00::numeric, 31) $$,
  'Plan Rule edit does not rewrite the instantiated current Monthly Action'
);

select lives_ok(
  $$
    delete from public.accounts
    where id = '11000000-0000-4000-8000-00000000008a'
      and owner_id = '00000000-0000-4000-8000-00000000008a'
  $$,
  'closed Monthly Action history permits Source Account link cleanup'
);

select results_eq(
  $$
    select count(*)
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and is_monthly_action
      and source_account_id is null
      and source_account_name = 'A Source'
  $$,
  $$ values (2::bigint) $$,
  'Source Account deletion preserves closed and current Monthly Action names'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008b","role":"authenticated"}';

select throws_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM')
    )
  $$,
  'P0001', 'monthly_actions_missing',
  'an owner cannot close a month with no Monthly Actions'
);

reset role;

insert into public.sop_records (
  owner_id, year_month, template_id, step_key, step_label,
  due_day, completed, amount, sort_order, counts_toward_milestone,
  milestone_amount, is_monthly_action, rule_amount, scheduled_for,
  target_account_id, target_account_name
) values (
  '00000000-0000-4000-8000-00000000008b',
  to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM'),
  '20000000-0000-4000-8000-00000000008b',
  'b_monthly_rule', 'B Monthly Rule', 15, false, 200, 1,
  true, 200, true, 200,
  public.plan_scheduled_date((date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month')::date, 15),
  '10000000-0000-4000-8000-00000000008b', 'B Savings'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008b","role":"authenticated"}';

select throws_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM')
    )
  $$,
  'P0001', 'monthly_actions_incomplete',
  'an owner cannot close a month with incomplete Monthly Actions'
);

reset role;

update public.sop_records
set completed = true, completed_at = current_timestamp
where owner_id = '00000000-0000-4000-8000-00000000008b'
  and year_month = to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM');

update public.sop_templates
set is_active = false
where id = '20000000-0000-4000-8000-00000000008b';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008b","role":"authenticated"}';

select throws_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM')
    )
  $$,
  'P0001', 'no_active_plan_rules',
  'Monthly Close rejects a rollover with no active Rule or current Monthly Action'
);

reset role;

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008b'
      and review_completed_at is not null
  ),
  0::bigint,
  'no-active-Rule rejection rolls back Monthly Review completion'
);

update public.sop_templates
set is_active = true
where id = '20000000-0000-4000-8000-00000000008b';

insert into public.sop_records (
  owner_id, year_month, template_id, step_key, step_label,
  due_day, completed, amount, sort_order, is_monthly_action
) values (
  '00000000-0000-4000-8000-00000000008b',
  to_char(date_trunc('month', current_timestamp at time zone 'America/New_York'), 'YYYY-MM'),
  null, 'b_monthly_rule', 'Legacy conflict', 1, false, null, 1, false
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008b","role":"authenticated"}';

select throws_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM')
    )
  $$,
  'P0001', 'legacy_action_conflict',
  'rollover conflict aborts Monthly Review completion'
);

select results_eq(
  $$
    select
      review_completed_at,
      (
        select count(*)
        from public.sop_records
        where owner_id = '00000000-0000-4000-8000-00000000008b'
          and year_month = to_char(date_trunc('month', current_timestamp at time zone 'America/New_York'), 'YYYY-MM')
          and is_monthly_action
      )
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008b'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM')
  $$,
  $$ values (null::timestamptz, 0::bigint) $$,
  'rollover conflict rolls back close timestamp and Monthly Action creation'
);

reset role;
delete from public.sop_records
where owner_id = '00000000-0000-4000-8000-00000000008b'
  and year_month = to_char(date_trunc('month', current_timestamp at time zone 'America/New_York'), 'YYYY-MM')
  and not is_monthly_action;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000008b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000008b","role":"authenticated"}';

select lives_ok(
  $$
    select public.close_monthly_review(
      to_char(date_trunc('month', current_timestamp at time zone 'America/New_York') - interval '1 month', 'YYYY-MM')
    )
  $$,
  'owner B can close independently after resolving the rollover conflict'
);

reset role;

select results_eq(
  $$
    select review_completed_at
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000008a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM')
  $$,
  $$ select review_completed_at from first_review_completion $$,
  'owner B close does not change owner A Monthly Review completion'
);

select is(
  (
    select count(*)
    from public.salary_configs
    where owner_id in (
      '00000000-0000-4000-8000-00000000008a',
      '00000000-0000-4000-8000-00000000008b'
    )
  ),
  0::bigint,
  'Monthly Close and rollover have no SalaryConfig dependency'
);

select * from finish();

rollback;
