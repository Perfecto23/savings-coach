begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(66);

select has_function(
  'public',
  'save_balance_observations',
  array['date', 'jsonb'],
  'save_balance_observations(date, jsonb) is the atomic Balance Observation seam'
);

select has_function(
  'public',
  'delete_balance_observations',
  array['date'],
  'delete_balance_observations(date) deletes one owner observation date atomically'
);

select has_function(
  'public',
  'get_sop_display_records',
  array['text'],
  'get_sop_display_records(text) is the safe Monthly SOP read seam'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'save_balance_observations',
        'delete_balance_observations'
      )
      and procedure.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
        where setting like 'search_path=%'
      )
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  2::bigint,
  'Balance Observation seams are authenticated definer functions with frozen search paths'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'get_sop_display_records'
      and procedure.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
        where setting like 'search_path=%'
      )
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  1::bigint,
  'Monthly SOP display uses an authenticated definer seam with a frozen search path'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'save_owner_setup_step'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  1::bigint,
  'Setup remains able to create its first observation through an owner-safe definer seam'
);

select is(
  (
    select confdeltype
    from pg_constraint
    where conname = 'balance_snapshots_account_id_fkey'
      and conrelid = 'public.balance_snapshots'::regclass
  ),
  'r'::"char",
  'Account deletion restricts historical Balance Snapshot loss'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'balance_observations', 'progress_events', 'account_archives',
        'plan_path_history'
      )
  ),
  0::bigint,
  'Trustworthy Progress adds no observation, event, archive, or history table'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-00000000007a',
    'authenticated', 'authenticated', 'progress-a@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-00000000007b',
    'authenticated', 'authenticated', 'progress-b@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.accounts (id, owner_id, name, bank, purpose)
values
  ('10000000-0000-4000-8000-00000000007a', '00000000-0000-4000-8000-00000000007a', 'A Primary Savings', null, 'savings'),
  ('11000000-0000-4000-8000-00000000007a', '00000000-0000-4000-8000-00000000007a', 'A Secondary Savings', null, 'savings'),
  ('12000000-0000-4000-8000-00000000007a', '00000000-0000-4000-8000-00000000007a', 'A Source', null, 'salary'),
  ('13000000-0000-4000-8000-00000000007a', '00000000-0000-4000-8000-00000000007a', 'A Spare', null, 'flexible'),
  ('10000000-0000-4000-8000-00000000007b', '00000000-0000-4000-8000-00000000007b', 'B Savings', null, 'savings');

insert into public.owner_setup (
  owner_id, locale, time_zone, base_currency, savings_account_id
) values
  ('00000000-0000-4000-8000-00000000007a', 'en-SG', 'Asia/Singapore', 'SGD', '10000000-0000-4000-8000-00000000007a'),
  ('00000000-0000-4000-8000-00000000007b', 'en-US', 'America/New_York', 'USD', '10000000-0000-4000-8000-00000000007b');

insert into public.balance_snapshots (account_id, recorded_at, balance)
values
  (
    '10000000-0000-4000-8000-00000000007a',
    (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '2 months' + interval '9 days')::date,
    100
  ),
  (
    '11000000-0000-4000-8000-00000000007a',
    (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '2 months' + interval '19 days')::date,
    50
  ),
  (
    '10000000-0000-4000-8000-00000000007a',
    (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month' + interval '14 days')::date,
    120
  ),
  (
    '11000000-0000-4000-8000-00000000007a',
    (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') + interval '9 days')::date,
    70
  );

insert into public.monthly_milestones (
  owner_id, year_month, planned_savings, planned_total_savings,
  status, is_plan_path
) values
  (
    '00000000-0000-4000-8000-00000000007a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '2 months', 'YYYY-MM'),
    0, 0, 'pending', false
  ),
  (
    '00000000-0000-4000-8000-00000000007a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
    0, 0, 'pending', false
  );

insert into public.sop_templates (
  id, owner_id, step_key, step_label, due_day,
  from_account_id, to_account_id, default_amount,
  sort_order, is_active, is_plan_rule
) values (
  '21000000-0000-4000-8000-00000000007a',
  '00000000-0000-4000-8000-00000000007a',
  'legacy_display',
  'Legacy display',
  8,
  '13000000-0000-4000-8000-00000000007a',
  '11000000-0000-4000-8000-00000000007a',
  10,
  20,
  true,
  false
);

insert into public.sop_records (
  owner_id, year_month, template_id, step_key, step_label,
  due_day, amount, sort_order, counts_toward_milestone,
  milestone_amount, is_monthly_action
) values
  (
    '00000000-0000-4000-8000-00000000007a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM'),
    '21000000-0000-4000-8000-00000000007a',
    'legacy_display',
    'Legacy display',
    8,
    10,
    20,
    true,
    10,
    false
  ),
  (
    '00000000-0000-4000-8000-00000000007a',
    to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM'),
    null,
    'adhoc_display',
    'Ad hoc display',
    9,
    null,
    30,
    false,
    null,
    false
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000071",
        "name":"Progress reserve",
        "amount":"100.00",
        "due_day":15,
        "source_account_id":"12000000-0000-4000-8000-00000000007a",
        "target_account_id":"10000000-0000-4000-8000-00000000007a"
      }'::jsonb
    )
  $$,
  'owner A can prepare a Plan Rule for Progress projection'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'Plan Activation builds the initial Plan Path and Balance Observations'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      jsonb_build_object(
        'balance', '999.00',
        'recorded_at',
        (current_timestamp at time zone 'Asia/Singapore')::date
      )
    )
  $$,
  'P0001', 'initial_balance_locked',
  'Plan Activation locks the Setup initial-balance seam'
);

select results_eq(
  $$
    select
      (
        select count(*)
        from public.balance_snapshots
        where account_id = '10000000-0000-4000-8000-00000000007a'
          and recorded_at = (
            current_timestamp at time zone 'Asia/Singapore'
          )::date
      ),
      planned_total_savings,
      actual_total_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(
        date_trunc('month', current_timestamp at time zone 'Asia/Singapore'),
        'YYYY-MM'
      )
  $$,
  $$ values (0::bigint, 290.00::numeric, 190.00::numeric) $$,
  'a rejected post-activation Setup write leaves Snapshot and Progress state unchanged'
);

select throws_ok(
  $$ select public.get_sop_display_records('2026-13') $$,
  'P0001', null,
  'Monthly SOP display rejects an invalid year-month'
);

select results_eq(
  $$
    select year_month, actual_savings, actual_total_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and year_month <= to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
    order by year_month
  $$,
  $$
    values
      (to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '2 months', 'YYYY-MM'), null::numeric, 150.00::numeric),
      (to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'), 20.00::numeric, 170.00::numeric),
      (to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM'), 20.00::numeric, 190.00::numeric)
  $$,
  'Balance Observations carry forward each Savings Account and use adjacent observed months'
);

select results_eq(
  $$
    select planned_savings, planned_total_savings, status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (100.00::numeric, 290.00::numeric, 'pending'::text) $$,
  'initial Plan Path starts from the Savings Account balance total and Action-only status'
);

select lives_ok(
  $$ delete from public.accounts where id = '12000000-0000-4000-8000-00000000007a' $$,
  'an unlinked Source Account without observations remains deletable'
);

select ok(
  (
    select source_account_id is null and source_account_name = 'A Source'
    from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and template_id = '20000000-0000-4000-8000-000000000071'
      and is_monthly_action
  ),
  'Account deletion preserves the historical Monthly Action source name snapshot'
);

select results_eq(
  $$
    select distinct display_key
    from jsonb_array_elements(
      public.get_sop_display_records(
        to_char(
          date_trunc('month', current_timestamp at time zone 'Asia/Singapore'),
          'YYYY-MM'
        )
      )
    ) as display_record
    cross join lateral jsonb_object_keys(display_record) as display_key
    order by display_key
  $$,
  $$
    values
      ('amount'::text),
      ('completed'::text),
      ('completed_at'::text),
      ('due_day'::text),
      ('id'::text),
      ('is_ad_hoc'::text),
      ('note'::text),
      ('scheduled_for'::text),
      ('source_account_name'::text),
      ('step_label'::text),
      ('target_account_name'::text),
      ('year_month'::text)
  $$,
  'Monthly SOP display exposes only the frozen UI field allowlist'
);

select results_eq(
  $$
    select
      display_record ->> 'step_label',
      display_record ->> 'source_account_name',
      display_record ->> 'target_account_name',
      (display_record ->> 'is_ad_hoc')::boolean
    from jsonb_array_elements(
      public.get_sop_display_records(
        to_char(
          date_trunc('month', current_timestamp at time zone 'Asia/Singapore'),
          'YYYY-MM'
        )
      )
    ) as display_record
    order by display_record ->> 'step_label'
  $$,
  $$
    values
      ('Ad hoc display'::text, null::text, null::text, true),
      ('Legacy display'::text, 'A Spare'::text, 'A Secondary Savings'::text, false),
      ('Progress reserve'::text, 'A Source'::text, 'A Primary Savings'::text, false)
  $$,
  'Monthly SOP display resolves legacy accounts and preserves Monthly Action snapshots'
);

select throws_ok(
  $$
    insert into public.balance_snapshots (account_id, recorded_at, balance)
    values ('13000000-0000-4000-8000-00000000007a', (current_timestamp at time zone 'Asia/Singapore')::date, 10)
  $$,
  '42501', null,
  'authenticated clients cannot insert Balance Snapshots outside the RPC'
);

select is_empty(
  $$
    update public.balance_snapshots
    set balance = 999
    where account_id = '10000000-0000-4000-8000-00000000007a'
    returning id
  $$,
  'authenticated clients cannot update Balance Snapshots outside the RPC'
);

select is_empty(
  $$
    delete from public.balance_snapshots
    where account_id = '10000000-0000-4000-8000-00000000007a'
    returning id
  $$,
  'authenticated clients cannot delete Balance Snapshots outside the RPC'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007b","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      jsonb_build_object(
        'balance', '500.00',
        'recorded_at', (current_timestamp at time zone 'America/New_York')::date
      )
    )
  $$,
  'Setup can create its first Balance Snapshot after direct writes close'
);

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id = '10000000-0000-4000-8000-00000000007b'
      and recorded_at = (current_timestamp at time zone 'America/New_York')::date
  ),
  1::bigint,
  'Setup stores exactly one first Balance Snapshot through its definer seam'
);

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      jsonb_build_object(
        'balance', '500.00',
        'recorded_at',
        (current_timestamp at time zone 'America/New_York')::date
      )
    )
  $$,
  'an exact pre-activation initial-balance retry is idempotent'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      jsonb_build_object(
        'balance', '501.00',
        'recorded_at',
        (current_timestamp at time zone 'America/New_York')::date
      )
    )
  $$,
  'P0001', 'initial_balance_locked',
  'a different value cannot rewrite the first Setup Balance Snapshot'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      jsonb_build_object(
        'balance', '500.00',
        'recorded_at',
        (current_timestamp at time zone 'America/New_York')::date - 1
      )
    )
  $$,
  'P0001', 'initial_balance_locked',
  'a different date cannot add a second Setup Balance Snapshot'
);

select throws_ok(
  $$
    select public.delete_balance_observations(
      (current_timestamp at time zone 'America/New_York')::date
    )
  $$,
  'P0001', null,
  'the last Setup-linked Balance Snapshot cannot be deleted'
);

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id = '10000000-0000-4000-8000-00000000007b'
  ),
  1::bigint,
  'a rejected last-Setup-observation deletion preserves the Balance Snapshot'
);

select is(
  jsonb_array_length(
    public.get_sop_display_records(
      to_char(
        date_trunc('month', current_timestamp at time zone 'America/New_York'),
        'YYYY-MM'
      )
    )
  ),
  0,
  'owner B Monthly SOP display cannot read owner A records'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007a","role":"authenticated"}';

select results_eq(
  $$
    select
      (result.payload ->> 'saved_count')::integer,
      not result.payload ?| array['owner_id', 'is_plan_path']
    from (
      select public.save_balance_observations(
        (current_timestamp at time zone 'Asia/Singapore')::date,
        jsonb_build_array(
          jsonb_build_object('account_id', '10000000-0000-4000-8000-00000000007a', 'balance', '200.00'),
          jsonb_build_object('account_id', '11000000-0000-4000-8000-00000000007a', 'balance', '80.00')
        )
      ) as payload
    ) as result
  $$,
  $$ values (2, true) $$,
  'the atomic save seam returns a safe two-account receipt'
);

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id in ('10000000-0000-4000-8000-00000000007a', '11000000-0000-4000-8000-00000000007a')
      and recorded_at = (current_timestamp at time zone 'Asia/Singapore')::date
  ),
  2::bigint,
  'one observation date stores one row for each submitted account'
);

select results_eq(
  $$
    select actual_savings, actual_total_savings, planned_total_savings, status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (110.00::numeric, 280.00::numeric, 290.00::numeric, 'pending'::text) $$,
  'Balance Observation changes Net Worth fields without drifting Plan Path or execution status'
);

select lives_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      jsonb_build_array(
        jsonb_build_object('account_id', '10000000-0000-4000-8000-00000000007a', 'balance', '210.00'),
        jsonb_build_object('account_id', '11000000-0000-4000-8000-00000000007a', 'balance', '90.00')
      )
    )
  $$,
  'retrying one observation date updates the existing account rows'
);

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id in ('10000000-0000-4000-8000-00000000007a', '11000000-0000-4000-8000-00000000007a')
      and recorded_at = (current_timestamp at time zone 'Asia/Singapore')::date
  ),
  2::bigint,
  'observation retry does not duplicate account-date rows'
);

select results_eq(
  $$
    select actual_savings, actual_total_savings, planned_total_savings, status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (130.00::numeric, 300.00::numeric, 290.00::numeric, 'pending'::text) $$,
  'observation retry recomputes only authoritative Net Worth fields'
);

select throws_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      '[
        {"account_id":"10000000-0000-4000-8000-00000000007a","balance":"1.00"},
        {"account_id":"10000000-0000-4000-8000-00000000007a","balance":"2.00"}
      ]'::jsonb
    )
  $$,
  'P0001', null,
  'duplicate account observations are rejected'
);

select results_eq(
  $$
    select balance
    from public.balance_snapshots
    where account_id = '10000000-0000-4000-8000-00000000007a'
      and recorded_at = (current_timestamp at time zone 'Asia/Singapore')::date
  $$,
  $$ values (210.00::numeric) $$,
  'a rejected duplicate payload rolls back every attempted observation'
);

select throws_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      '[{"account_id":"10000000-0000-4000-8000-00000000007b","balance":"1.00"}]'::jsonb
    )
  $$,
  'P0001', null,
  'owner A cannot save an observation for owner B account'
);

select throws_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date + 1,
      '[{"account_id":"10000000-0000-4000-8000-00000000007a","balance":"1.00"}]'::jsonb
    )
  $$,
  'P0001', null,
  'future Balance Observation dates are rejected in the owner timezone'
);

select throws_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      '[{"account_id":"10000000-0000-4000-8000-00000000007a","balance":"NaN"}]'::jsonb
    )
  $$,
  'P0001', null,
  'non-finite Balance Observation amounts are rejected'
);

select throws_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      '[{"account_id":"10000000-0000-4000-8000-00000000007a","balance":"1.001"}]'::jsonb
    )
  $$,
  'P0001', null,
  'Balance Observation RPC rejects amounts with more than two decimals'
);

reset role;

select throws_ok(
  $$
    insert into public.balance_snapshots (account_id, recorded_at, balance)
    values (
      '13000000-0000-4000-8000-00000000007a',
      (current_timestamp at time zone 'Asia/Singapore')::date,
      'NaN'::numeric
    )
  $$,
  '23514', null,
  'Balance Snapshot CHECK rejects historical NaN values'
);

select throws_ok(
  $$
    insert into public.balance_snapshots (account_id, recorded_at, balance)
    values (
      '13000000-0000-4000-8000-00000000007a',
      (current_timestamp at time zone 'Asia/Singapore')::date,
      -1
    )
  $$,
  '23514', null,
  'Balance Snapshot CHECK rejects historical negative values'
);

select throws_ok(
  $$
    insert into public.balance_snapshots (account_id, recorded_at, balance)
    values (
      '13000000-0000-4000-8000-00000000007a',
      (current_timestamp at time zone 'Asia/Singapore')::date,
      1.001
    )
  $$,
  '23514', null,
  'Balance Snapshot CHECK rejects historical values beyond two decimals'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007a","role":"authenticated"}';

select results_eq(
  $$
    select
      (result.payload ->> 'deleted_count')::integer,
      not result.payload ? 'owner_id'
    from (
      select public.delete_balance_observations(
        (current_timestamp at time zone 'Asia/Singapore')::date
      ) as payload
    ) as result
  $$,
  $$ values (2, true) $$,
  'deleting one observed date removes every owner A account row atomically'
);

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id in ('10000000-0000-4000-8000-00000000007a', '11000000-0000-4000-8000-00000000007a')
      and recorded_at = (current_timestamp at time zone 'Asia/Singapore')::date
  ),
  0::bigint,
  'owner A observed-date deletion leaves no partial same-date row'
);

reset role;

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id = '10000000-0000-4000-8000-00000000007b'
      and recorded_at = (current_timestamp at time zone 'America/New_York')::date
  ),
  1::bigint,
  'owner A observed-date deletion preserves owner B snapshot'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007a","role":"authenticated"}';

select results_eq(
  $$
    select actual_savings, actual_total_savings, planned_total_savings, status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (20.00::numeric, 190.00::numeric, 290.00::numeric, 'pending'::text) $$,
  'observed-date deletion recomputes Progress from remaining observations'
);

select throws_ok(
  $$ select public.delete_balance_observations((current_timestamp at time zone 'Asia/Singapore')::date) $$,
  'P0001', null,
  'deleting a missing owner observation date returns a stable error'
);

select throws_ok(
  $$ delete from public.accounts where id = '10000000-0000-4000-8000-00000000007a' $$,
  'P0001', null,
  'the Setup-linked account cannot be deleted'
);

select throws_ok(
  $$ delete from public.accounts where id = '11000000-0000-4000-8000-00000000007a' $$,
  '23503', null,
  'an account with historical Balance Snapshots cannot be deleted implicitly'
);

select is_empty(
  $$
    update public.monthly_milestones
    set actual_savings = 999
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
    returning id
  $$,
  'authenticated clients cannot update marked Plan Path rows directly'
);

select is_empty(
  $$
    delete from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
    returning id
  $$,
  'authenticated clients cannot delete marked Plan Path rows directly'
);

select throws_ok(
  $$
    insert into public.monthly_milestones (
      owner_id, year_month, planned_savings, planned_total_savings,
      status, is_plan_path
    ) values (
      '00000000-0000-4000-8000-00000000007a',
      '2099-01', 1, 1, 'pending', true
    )
  $$,
  '42501', null,
  'authenticated clients cannot insert marked Plan Path rows directly'
);

reset role;

select throws_ok(
  $$
    delete from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
  $$,
  'P0001', null,
  'marked Plan Path deletion is blocked below RLS'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007a","role":"authenticated"}';

select isnt_empty(
  $$
    insert into public.monthly_milestones (
      owner_id, year_month, planned_savings, planned_total_savings,
      status, is_plan_path
    ) values (
      '00000000-0000-4000-8000-00000000007a',
      '1999-01', 0, 0, 'pending', false
    )
    returning id
  $$,
  'legacy Milestones remain directly insertable by their owner'
);

select isnt_empty(
  $$
    update public.monthly_milestones
    set status = 'on_track'
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and year_month = '1999-01'
      and not is_plan_path
    returning id
  $$,
  'legacy Milestones remain directly editable by their owner'
);

select isnt_empty(
  $$
    delete from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and year_month = '1999-01'
      and not is_plan_path
    returning id
  $$,
  'legacy Milestones remain directly deletable by their owner'
);

select lives_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      '[{"account_id":"10000000-0000-4000-8000-00000000007a","balance":"50.00"}]'::jsonb
    )
  $$,
  'a later Balance Observation can record a lower Savings Account balance'
);

select results_eq(
  $$
    select actual_savings, actual_total_savings, planned_total_savings, status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (-50.00::numeric, 120.00::numeric, 290.00::numeric, 'pending'::text) $$,
  'negative Net Worth Change does not change Action-only execution status'
);

select lives_ok(
  $$
    select public.update_monthly_action(
      (
        select id
        from public.sop_records
        where owner_id = '00000000-0000-4000-8000-00000000007a'
          and is_monthly_action
      ),
      '{"completed":true}'::jsonb
    )
  $$,
  'owner A can confirm the current Monthly Action after observing a balance change'
);

select results_eq(
  $$
    select actual_savings, actual_total_savings, planned_total_savings, status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000007a'
      and is_plan_path
      and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')
  $$,
  $$ values (-50.00::numeric, 120.00::numeric, 290.00::numeric, 'on_track'::text) $$,
  'Action completion changes execution status without rewriting Net Worth fields'
);

reset role;

update public.monthly_milestones
set is_plan_path = false
where owner_id = '00000000-0000-4000-8000-00000000007a'
  and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000007a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000007a","role":"authenticated"}';

select throws_ok(
  $$
    select public.save_balance_observations(
      (current_timestamp at time zone 'Asia/Singapore')::date,
      '[{"account_id":"13000000-0000-4000-8000-00000000007a","balance":"10.00"}]'::jsonb
    )
  $$,
  'P0001', null,
  'a missing active Plan Path aborts the Balance Observation transaction'
);

select is(
  (
    select count(*)
    from public.balance_snapshots
    where account_id = '13000000-0000-4000-8000-00000000007a'
      and recorded_at = (current_timestamp at time zone 'Asia/Singapore')::date
  ),
  0::bigint,
  'Plan Path projection failure rolls back every Balance Snapshot write'
);

select is(
  (
    select count(*)
    from public.salary_configs
    where owner_id = '00000000-0000-4000-8000-00000000007a'
  ),
  0::bigint,
  'Trustworthy Progress has no SalaryConfig dependency'
);

select * from finish();

rollback;
