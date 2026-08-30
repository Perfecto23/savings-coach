begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(74);

select has_column('public', 'sop_templates', 'is_plan_rule', 'Plan Rules are marked SOP Templates');
select has_column('public', 'sop_records', 'is_monthly_action', 'Monthly Actions are marked SOP Records');
select has_column('public', 'sop_records', 'scheduled_for', 'Monthly Actions store the clamped due date');
select has_column('public', 'monthly_milestones', 'is_plan_path', 'Plan Path nodes are marked Monthly Milestones');
select has_column('public', 'owner_setup', 'plan_activated_at', 'Plan activation stores one owner-scoped timestamp');
select has_function('public', 'save_plan_rule', array['jsonb'], 'save_plan_rule(jsonb) is the Plan Rule seam');
select has_function('public', 'set_plan_rule_active', array['uuid', 'boolean'], 'set_plan_rule_active(uuid, boolean) is the active-state seam');
select has_function('public', 'activate_savings_plan', array[]::text[], 'activate_savings_plan() is the activation seam');
select has_function('public', 'update_monthly_action', array['uuid', 'jsonb'], 'update_monthly_action(uuid, jsonb) is the Monthly Action seam');

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sop_records'
      and column_name in (
        'rule_amount', 'scheduled_for',
        'source_account_id', 'source_account_name',
        'target_account_id', 'target_account_name'
      )
  ),
  6::bigint,
  'Monthly Actions expose all frozen amount, schedule, source, and target snapshots'
);

select is(
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'sop_records_owner_rule_month_action_key'
      and indexdef like '%owner_id, template_id, year_month%'
      and indexdef like '%WHERE (is_monthly_action AND (template_id IS NOT NULL))%'
  ),
  1::bigint,
  'one Rule can produce at most one marked Monthly Action per owner and month'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conname in ('sop_records_source_account_fkey', 'sop_records_target_account_fkey')
      and contype = 'f'
      and confdeltype = 'n'
      and cardinality(confdelsetcols) = 1
  ),
  2::bigint,
  'Monthly Action account links are owner-safe and null only their account IDs'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in ('save_plan_rule', 'set_plan_rule_active', 'activate_savings_plan')
      and procedure.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
        where setting like 'search_path=%'
      )
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  3::bigint,
  'public Plan seams are authenticated definer functions with a frozen search path'
);

select ok(
  not has_column_privilege('authenticated', 'public.owner_setup', 'plan_activated_at', 'UPDATE')
    and has_column_privilege('authenticated', 'public.owner_setup', 'locale', 'UPDATE'),
  'authenticated clients cannot spoof plan_activated_at while Setup fields remain editable'
);

select ok(
  not has_table_privilege('authenticated', 'public.owner_setup', 'INSERT')
    and has_column_privilege('authenticated', 'public.owner_setup', 'owner_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.owner_setup', 'locale', 'INSERT')
    and has_column_privilege('authenticated', 'public.owner_setup', 'time_zone', 'INSERT')
    and has_column_privilege('authenticated', 'public.owner_setup', 'base_currency', 'INSERT')
    and has_column_privilege('authenticated', 'public.owner_setup', 'savings_account_id', 'INSERT'),
  'Setup inserts use a column allowlist that still supports the invoker RPC'
);

select ok(
  not has_column_privilege('authenticated', 'public.owner_setup', 'plan_activated_at', 'INSERT'),
  'authenticated clients cannot insert plan activation evidence directly'
);

select results_eq(
  $$
    values
      (public.plan_scheduled_date('2027-02-01'::date, 31)),
      (public.plan_scheduled_date('2028-02-01'::date, 31)),
      (public.plan_scheduled_date('2027-04-01'::date, 31))
  $$,
  $$ values ('2027-02-28'::date), ('2028-02-29'::date), ('2027-04-30'::date) $$,
  'Monthly cadence clamps days 29-31 to each calendar month end'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('savings_plans', 'plan_events', 'schedules', 'plan_versions')
  ),
  0::bigint,
  'Plan activation adds no unnecessary Plan, event, schedule, or version tables'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-00000000005a',
    'authenticated', 'authenticated', 'plan-a@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-00000000005b',
    'authenticated', 'authenticated', 'plan-b@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.accounts (id, owner_id, name, bank, purpose)
values
  ('10000000-0000-4000-8000-00000000005a', '00000000-0000-4000-8000-00000000005a', 'A Savings', null, 'savings'),
  ('11000000-0000-4000-8000-00000000005a', '00000000-0000-4000-8000-00000000005a', 'A Source', null, 'salary'),
  ('10000000-0000-4000-8000-00000000005b', '00000000-0000-4000-8000-00000000005b', 'B Savings', null, 'savings');

insert into public.owner_setup (
  owner_id, locale, time_zone, base_currency, savings_account_id
) values
  (
    '00000000-0000-4000-8000-00000000005a',
    'en-SG', 'Asia/Singapore', 'SGD',
    '10000000-0000-4000-8000-00000000005a'
  ),
  (
    '00000000-0000-4000-8000-00000000005b',
    'en-US', 'America/New_York', 'USD',
    '10000000-0000-4000-8000-00000000005b'
  );

insert into public.balance_snapshots (account_id, recorded_at, balance)
values
  (
    '10000000-0000-4000-8000-00000000005a',
    (current_timestamp at time zone 'Asia/Singapore')::date,
    1000
  ),
  (
    '10000000-0000-4000-8000-00000000005b',
    (current_timestamp at time zone 'America/New_York')::date,
    2000
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000051",
        "name":"Monthly reserve",
        "amount":"100.00",
        "due_day":31,
        "source_account_id":"11000000-0000-4000-8000-00000000005a",
        "target_account_id":"10000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'owner A can save a positive monthly Plan Rule without SalaryConfig'
);

select results_eq(
  $$
    select is_plan_rule, default_amount, due_day, is_active
    from public.sop_templates
    where id = '20000000-0000-4000-8000-000000000051'
  $$,
  $$ values (true, 100.00::numeric, 31, true) $$,
  'Plan Rule reuses the marked SOP Template row'
);

select throws_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000052",
        "name":"Zero rule",
        "amount":"0",
        "due_day":10,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'P0001', null,
  'zero Plan Rule Amount is rejected'
);

select throws_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000055",
        "name":"NaN rule",
        "amount":"NaN",
        "due_day":10,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'P0001', null,
  'non-finite Plan Rule Amount is rejected'
);

select is(
  (
    select count(*)
    from public.sop_templates
    where id = '20000000-0000-4000-8000-000000000055'
  ),
  0::bigint,
  'a rejected non-finite amount creates no Plan Rule row'
);

reset role;

select throws_ok(
  $$
    insert into public.sop_records (
      owner_id, year_month, template_id, step_key, step_label, due_day,
      amount, counts_toward_milestone, milestone_amount,
      is_monthly_action, rule_amount, scheduled_for
    ) values (
      '00000000-0000-4000-8000-00000000005a',
      '2099-01',
      '20000000-0000-4000-8000-000000000051',
      'nan_monthly_action',
      'NaN Monthly Action',
      10,
      100,
      true,
      100,
      true,
      'NaN'::numeric,
      '2099-01-10'
    )
  $$,
  '23514', null,
  'direct writes cannot store a non-finite Monthly Action amount'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005a","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.owner_setup (
      owner_id, locale, time_zone, base_currency, savings_account_id, plan_activated_at
    ) values (
      '00000000-0000-4000-8000-00000000005a',
      'en-SG', 'Asia/Singapore', 'SGD',
      '10000000-0000-4000-8000-00000000005a', now()
    )
  $$,
  '42501', null,
  'authenticated clients cannot direct-insert plan activation evidence'
);

select throws_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000053",
        "name":"Cross owner",
        "amount":"10.00",
        "due_day":10,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005b"
      }'::jsonb
    )
  $$,
  'P0001', null,
  'a Plan Rule cannot target another owner account'
);

insert into public.sop_templates (
  id, owner_id, step_key, step_label, due_day,
  to_account_id, default_amount, is_active
) values (
  '21000000-0000-4000-8000-00000000005a',
  '00000000-0000-4000-8000-00000000005a',
  'legacy_not_a_plan_rule',
  'Legacy non-plan template',
  9,
  '10000000-0000-4000-8000-00000000005a',
  15,
  true
);

select throws_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"21000000-0000-4000-8000-00000000005a",
        "name":"Conversion attempt",
        "amount":"30.00",
        "due_day":10,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'P0001', null,
  'save_plan_rule cannot convert an existing legacy SopTemplate UUID'
);

select results_eq(
  $$
    select is_plan_rule, step_label, default_amount
    from public.sop_templates
    where id = '21000000-0000-4000-8000-00000000005a'
  $$,
  $$ values (false, 'Legacy non-plan template'::text, 15.00::numeric) $$,
  'a rejected legacy UUID conversion leaves the template unchanged'
);

insert into public.sop_records (
  owner_id, year_month, template_id, step_key, step_label, due_day, amount
) values (
  '00000000-0000-4000-8000-00000000005a',
  to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM'),
  null,
  'legacy_unrelated',
  'Legacy unrelated step',
  1,
  null
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'an unrelated partial legacy month does not prevent Plan activation'
);

select is(
  (select count(*) from public.salary_configs where owner_id = '00000000-0000-4000-8000-00000000005a'),
  0::bigint,
  'Plan activation has no SalaryConfig dependency'
);

select ok(
  (select plan_activated_at is not null from public.owner_setup where owner_id = '00000000-0000-4000-8000-00000000005a'),
  'Plan activation stores the first activation timestamp'
);

create temporary table first_activation as
select plan_activated_at
from public.owner_setup
where owner_id = '00000000-0000-4000-8000-00000000005a';

select is(
  (
    select count(*)
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_monthly_action
  ),
  1::bigint,
  'activation creates one current Monthly Action per active Rule'
);

select results_eq(
  $$
    select rule_amount, amount, milestone_amount,
      source_account_name, target_account_name,
      scheduled_for
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_monthly_action
  $$,
  $$
    values (
      100.00::numeric,
      100.00::numeric,
      100.00::numeric,
      'A Source'::text,
      'A Savings'::text,
      public.plan_scheduled_date(
        date_trunc('month', current_timestamp at time zone 'Asia/Singapore')::date,
        31
      )
    )
  $$,
  'Monthly Action freezes amount, source, target, and clamped schedule snapshots'
);

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_plan_path
      and year_month >= to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  ),
  12::bigint,
  'activation materializes the 12-month Plan Path'
);

select results_eq(
  $$
    select planned_savings, planned_total_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (100.00::numeric, 1100.00::numeric) $$,
  'current Plan Path starts from the latest balance plus Monthly Action amount'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'repeating activation is idempotent'
);

select is(
  (
    select count(*)
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_monthly_action
  ),
  1::bigint,
  'repeated activation does not duplicate Monthly Actions'
);

select results_eq(
  $$
    select setup.plan_activated_at = first_activation.plan_activated_at
    from public.owner_setup as setup
    cross join first_activation
    where setup.owner_id = '00000000-0000-4000-8000-00000000005a'
  $$,
  $$ values (true) $$,
  'repeated activation preserves the first activation timestamp'
);

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000054",
        "name":"Second reserve",
        "amount":"50.00",
        "due_day":15,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'owner A can add a second active Plan Rule'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'activation fills only the missing current Monthly Action'
);

select is(
  (
    select count(*)
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_monthly_action
  ),
  2::bigint,
  'multiple Rules produce one Action each'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (150.00::numeric) $$,
  'current Plan Path sums the materialized Monthly Actions'
);

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000051",
        "name":"Monthly reserve edited",
        "amount":"200.00",
        "due_day":30,
        "source_account_id":"11000000-0000-4000-8000-00000000005a",
        "target_account_id":"10000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'editing a Rule after activation succeeds'
);

select results_eq(
  $$
    select rule_amount, due_day, step_label
    from public.sop_records
    where template_id = '20000000-0000-4000-8000-000000000051'
      and is_monthly_action
  $$,
  $$ values (100.00::numeric, 31, 'Monthly reserve'::text) $$,
  'Rule edits do not rewrite the current Monthly Action snapshot'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') + interval '1 month', 'YYYY-MM')
  $$,
  $$ values (250.00::numeric) $$,
  'Rule edits change the uninstantiated future Plan Path'
);

select lives_ok(
  $$ select public.set_plan_rule_active('20000000-0000-4000-8000-000000000051', false) $$,
  'a Plan Rule can be deactivated'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (150.00::numeric) $$,
  'deactivation preserves the current materialized Action contribution'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') + interval '1 month', 'YYYY-MM')
  $$,
  $$ values (50.00::numeric) $$,
  'deactivation removes the Rule from the future Plan Path'
);

select lives_ok(
  $$ select public.set_plan_rule_active('20000000-0000-4000-8000-000000000051', true) $$,
  'a deactivated Plan Rule can be reactivated'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') + interval '1 month', 'YYYY-MM')
  $$,
  $$ values (250.00::numeric) $$,
  'reactivation restores the Rule contribution only to the future Plan Path'
);

select lives_ok(
  $$
    select public.update_monthly_action(
      (
        select id
        from public.sop_records
        where template_id = '20000000-0000-4000-8000-000000000051'
          and is_monthly_action
      ),
      '{"amount":"120.00","completed":true,"note":"Adjusted current action"}'::jsonb
    )
  $$,
  'the narrow Monthly Action RPC updates released mutable fields'
);

select results_eq(
  $$
    select amount, milestone_amount, rule_amount, completed,
      completed_at is not null, note, step_label, due_day
    from public.sop_records
    where template_id = '20000000-0000-4000-8000-000000000051'
      and is_monthly_action
  $$,
  $$
    values (
      120.00::numeric, 120.00::numeric, 100.00::numeric, true, true,
      'Adjusted current action'::text, 'Monthly reserve'::text, 31
    )
  $$,
  'Monthly Action updates keep identity snapshots and completion timestamp consistent'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (170.00::numeric) $$,
  'current Plan Path uses edited Action amount instead of current Rule amount'
);

select throws_ok(
  $$
    select public.update_monthly_action(
      (
        select id
        from public.sop_records
        where template_id = '20000000-0000-4000-8000-000000000051'
          and is_monthly_action
      ),
      '{"amount":"NaN"}'::jsonb
    )
  $$,
  'P0001', null,
  'Monthly Action RPC rejects non-finite amounts'
);

select results_eq(
  $$
    select amount, milestone_amount, scheduled_for
    from public.sop_records
    where template_id = '20000000-0000-4000-8000-000000000051'
      and is_monthly_action
  $$,
  $$
    values (
      120.00::numeric,
      120.00::numeric,
      public.plan_scheduled_date(
        date_trunc('month', current_timestamp at time zone 'Asia/Singapore')::date,
        31
      )
    )
  $$,
  'a rejected Monthly Action patch rolls back without changing path inputs'
);

reset role;

select throws_ok(
  $$
    update public.sop_records
    set rule_amount = 999
    where template_id = '20000000-0000-4000-8000-000000000051'
      and is_monthly_action
  $$,
  'P0001', null,
  'Monthly Action Rule Amount snapshot is immutable'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005a","role":"authenticated"}';

select throws_ok(
  $$ delete from public.sop_templates where id = '20000000-0000-4000-8000-000000000051' $$,
  'P0001', null,
  'a Plan Rule with Monthly Actions cannot be hard deleted'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005b","role":"authenticated"}';

select throws_ok(
  $$ select public.set_plan_rule_active('20000000-0000-4000-8000-000000000051', true) $$,
  'P0001', null,
  'owner B cannot mutate owner A Plan Rule through the definer RPC'
);

select throws_ok(
  $$
    select public.update_monthly_action(
      (
        select id
        from public.sop_records
        where owner_id = '00000000-0000-4000-8000-00000000005a'
          and template_id = '20000000-0000-4000-8000-000000000051'
      ),
      '{"completed":false}'::jsonb
    )
  $$,
  'P0001', null,
  'owner B cannot update owner A Monthly Action through the definer RPC'
);

select throws_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000051",
        "name":"Same UUID attack",
        "amount":"10.00",
        "due_day":10,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005b"
      }'::jsonb
    )
  $$,
  'P0001', null,
  'owner B cannot false-succeed when reusing owner A Rule UUID'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005a","role":"authenticated"}';

select lives_ok(
  $$
    select public.set_plan_rule_active('20000000-0000-4000-8000-000000000051', false);
    select public.set_plan_rule_active('20000000-0000-4000-8000-000000000054', false);
  $$,
  'all Rules can be deactivated after first activation'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'an already-activated Plan can reproject with all Rules inactive'
);

select results_eq(
  $$
    select planned_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') + interval '1 month', 'YYYY-MM')
  $$,
  $$ values (0.00::numeric) $$,
  'all-inactive Rules produce a zero future Rule contribution'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005b","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-00000000005b",
        "name":"B rule",
        "amount":"25.00",
        "due_day":10,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000005b"
      }'::jsonb
    )
  $$,
  'owner B can create a Rule before deleting the Setup target account'
);

select lives_ok(
  $$ delete from public.accounts where id = '10000000-0000-4000-8000-00000000005b' $$,
  'deleting a Setup target account safely applies Plan Rule fallout'
);

select ok(
  (
    select not is_active and to_account_id is null
    from public.sop_templates
    where id = '20000000-0000-4000-8000-00000000005b'
  ) and (
    select savings_account_id is null
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000005b'
  ),
  'target deletion deactivates the Rule and clears only live account links'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000005a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000005a","role":"authenticated"}';

select lives_ok(
  $$ delete from public.accounts where id = '10000000-0000-4000-8000-00000000005a' $$,
  'deleting an activated target applies the frozen lifecycle contract'
);

select results_eq(
  $$
    select setup.plan_activated_at = first_activation.plan_activated_at
    from public.owner_setup as setup
    cross join first_activation
    where setup.owner_id = '00000000-0000-4000-8000-00000000005a'
  $$,
  $$ values (true) $$,
  'target deletion preserves the one-time activation timestamp'
);

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_plan_path
      and year_month >= to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  ),
  0::bigint,
  'target deletion invalidates current and future active Plan Path markers'
);

select ok(
  (
    select target_account_id is null and target_account_name = 'A Savings'
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and template_id = '20000000-0000-4000-8000-000000000051'
      and is_monthly_action
  ),
  'target deletion preserves historical Monthly Action target snapshot name'
);

insert into public.accounts (id, owner_id, name, bank, purpose)
values (
  '12000000-0000-4000-8000-00000000005a',
  '00000000-0000-4000-8000-00000000005a',
  'A Replacement Savings', null, 'savings'
);
update public.owner_setup
set savings_account_id = '12000000-0000-4000-8000-00000000005a'
where owner_id = '00000000-0000-4000-8000-00000000005a';
insert into public.balance_snapshots (account_id, recorded_at, balance)
values (
  '12000000-0000-4000-8000-00000000005a',
  (current_timestamp at time zone 'Asia/Singapore')::date,
  1500
);

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"22000000-0000-4000-8000-00000000005a",
        "name":"Replacement target rule",
        "amount":"80.00",
        "due_day":12,
        "source_account_id":null,
        "target_account_id":"12000000-0000-4000-8000-00000000005a"
      }'::jsonb
    )
  $$,
  'saving a Rule for the replacement target succeeds'
);

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_plan_path
      and year_month >= to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  ),
  0::bigint,
  'saving a replacement Rule does not silently reactivate the Plan'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'replacement target requires and accepts explicit reactivation'
);

select ok(
  (
    select setup.plan_activated_at = first_activation.plan_activated_at
    from public.owner_setup as setup
    cross join first_activation
    where setup.owner_id = '00000000-0000-4000-8000-00000000005a'
  ) and (
    select count(*) = 12
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000005a'
      and is_plan_path
      and year_month >= to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  ),
  'explicit reactivation restores 12 active nodes without rewriting activation history'
);

select * from finish();
rollback;
