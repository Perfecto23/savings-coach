begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

select has_column(
  'public',
  'owner_setup',
  'behavior_activated_at',
  'Behavior Activation stores one owner-scoped timestamp'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-00000000006a',
    'authenticated', 'authenticated', 'home-a@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-4000-8000-00000000006b',
    'authenticated', 'authenticated', 'home-b@example.invalid', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.accounts (id, owner_id, name, bank, purpose)
values
  (
    '10000000-0000-4000-8000-00000000006a',
    '00000000-0000-4000-8000-00000000006a',
    'Home A Savings', null, 'savings'
  ),
  (
    '10000000-0000-4000-8000-00000000006b',
    '00000000-0000-4000-8000-00000000006b',
    'Home B Savings', null, 'savings'
  );

insert into public.owner_setup (
  owner_id, locale, time_zone, base_currency, savings_account_id
) values
  (
    '00000000-0000-4000-8000-00000000006a',
    'en-SG', 'Asia/Singapore', 'SGD',
    '10000000-0000-4000-8000-00000000006a'
  ),
  (
    '00000000-0000-4000-8000-00000000006b',
    'en-US', 'America/New_York', 'USD',
    '10000000-0000-4000-8000-00000000006b'
  );

insert into public.balance_snapshots (account_id, recorded_at, balance)
values
  (
    '10000000-0000-4000-8000-00000000006a',
    (current_timestamp at time zone 'Asia/Singapore')::date,
    1000
  ),
  (
    '10000000-0000-4000-8000-00000000006b',
    (current_timestamp at time zone 'America/New_York')::date,
    2000
  );

select throws_ok(
  $$
    update public.owner_setup
    set behavior_activated_at = current_timestamp
    where owner_id = '00000000-0000-4000-8000-00000000006a'
  $$,
  '23514', null,
  'Behavior Activation cannot exist before Plan Activation'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.owner_setup', 'behavior_activated_at', 'INSERT'
  )
    and not has_column_privilege(
      'authenticated', 'public.owner_setup', 'behavior_activated_at', 'UPDATE'
    ),
  'authenticated clients cannot write Behavior Activation evidence directly'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'behavior_events', 'events', 'tasks', 'home_state', 'activity_events'
      )
  ),
  0::bigint,
  'Monthly execution adds no event, task, Home, or activity table'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'update_monthly_action'
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
  'Monthly Action updates use an authenticated definer seam with a frozen search path'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000006a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000006a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000061",
        "name":"Home monthly reserve",
        "amount":"100.00",
        "due_day":31,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000006a"
      }'::jsonb
    )
  $$,
  'owner A can prepare one Plan Rule for monthly execution'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'owner A can prepare the current Monthly Action through Plan Activation'
);

select is_empty(
  $$
    update public.sop_records
    set completed = true, completed_at = current_timestamp
    where owner_id = '00000000-0000-4000-8000-00000000006a'
      and is_monthly_action
    returning id
  $$,
  'authenticated clients cannot update a Monthly Action directly'
);

select is_empty(
  $$
    delete from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000006a'
      and is_monthly_action
    returning id
  $$,
  'authenticated clients cannot delete a Monthly Action directly'
);

select throws_ok(
  $$
    insert into public.sop_records (
      owner_id, year_month, template_id, step_key, step_label, due_day,
      amount, counts_toward_milestone, milestone_amount,
      is_monthly_action, rule_amount, scheduled_for
    ) values (
      '00000000-0000-4000-8000-00000000006a',
      '2099-01',
      '20000000-0000-4000-8000-000000000061',
      'forged_monthly_action',
      'Forged Monthly Action',
      10,
      100,
      true,
      100,
      true,
      100,
      '2099-01-10'
    )
  $$,
  '42501', null,
  'authenticated clients cannot insert a Monthly Action directly'
);

select isnt_empty(
  $$
    insert into public.sop_records (
      owner_id, year_month, template_id, step_key, step_label, due_day,
      amount, counts_toward_milestone, is_monthly_action
    ) values (
      '00000000-0000-4000-8000-00000000006a',
      '2099-02',
      null,
      'legacy_home_step',
      'Legacy Home step',
      2,
      10,
      false,
      false
    )
    returning id
  $$,
  'legacy monthly SOP steps remain directly insertable by their owner'
);

select isnt_empty(
  $$
    update public.sop_records
    set note = 'Owner note'
    where owner_id = '00000000-0000-4000-8000-00000000006a'
      and step_key = 'legacy_home_step'
    returning id
  $$,
  'legacy monthly SOP steps remain directly editable by their owner'
);

select isnt_empty(
  $$
    delete from public.sop_records
    where owner_id = '00000000-0000-4000-8000-00000000006a'
      and step_key = 'legacy_home_step'
    returning id
  $$,
  'legacy monthly SOP steps remain directly deletable by their owner'
);

select throws_ok(
  $$
    select public.update_monthly_action(
      (
        select id
        from public.sop_records
        where owner_id = '00000000-0000-4000-8000-00000000006a'
          and is_monthly_action
      ),
      '{"owner_id":"00000000-0000-4000-8000-00000000006b"}'::jsonb
    )
  $$,
  'P0001', null,
  'Monthly Action updates reject fields outside the public patch allowlist'
);

select results_eq(
  $$
    select
      (result.payload ->> 'completed')::boolean,
      (result.payload ->> 'behavior_activated_now')::boolean,
      not result.payload ?| array[
        'owner_id', 'template_id', 'is_monthly_action',
        'counts_toward_milestone'
      ]
    from (
      select public.update_monthly_action(
        (
          select id
          from public.sop_records
          where owner_id = '00000000-0000-4000-8000-00000000006a'
            and is_monthly_action
        ),
        '{"completed":true}'::jsonb
      ) as payload
    ) as result
  $$,
  $$ values (true, true, true) $$,
  'completing the current Monthly Action emits Behavior Activation once'
);

select ok(
  (
    select behavior_activated_at is not null
      and behavior_activated_at >= plan_activated_at
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000006a'
  ),
  'the qualifying completion persists Behavior Activation after Plan Activation'
);

create temporary table first_behavior_activation as
select
  setup.behavior_activated_at,
  action.completed_at
from public.owner_setup as setup
join public.sop_records as action on action.owner_id = setup.owner_id
where setup.owner_id = '00000000-0000-4000-8000-00000000006a'
  and action.is_monthly_action;

select results_eq(
  $$
    select
      (result.payload ->> 'completed')::boolean,
      (result.payload ->> 'behavior_activated_now')::boolean
    from (
      select public.update_monthly_action(
        (
          select id
          from public.sop_records
          where owner_id = '00000000-0000-4000-8000-00000000006a'
            and is_monthly_action
        ),
        '{"completed":true}'::jsonb
      ) as payload
    ) as result
  $$,
  $$ values (true, false) $$,
  'repeating completion is idempotent and does not emit Behavior Activation again'
);

select results_eq(
  $$
    select setup.behavior_activated_at, action.completed_at
    from public.owner_setup as setup
    join public.sop_records as action on action.owner_id = setup.owner_id
    where setup.owner_id = '00000000-0000-4000-8000-00000000006a'
      and action.is_monthly_action
  $$,
  $$
    select behavior_activated_at, completed_at
    from first_behavior_activation
  $$,
  'idempotent completion preserves first evidence and completion timestamps'
);

select results_eq(
  $$
    select
      (result.payload ->> 'completed')::boolean,
      (result.payload ->> 'behavior_activated_now')::boolean
    from (
      select public.update_monthly_action(
        (
          select id
          from public.sop_records
          where owner_id = '00000000-0000-4000-8000-00000000006a'
            and is_monthly_action
        ),
        '{"completed":false}'::jsonb
      ) as payload
    ) as result
  $$,
  $$ values (false, false) $$,
  'reopening a Monthly Action does not emit Behavior Activation'
);

select results_eq(
  $$
    select
      setup.behavior_activated_at,
      action.completed,
      action.completed_at
    from public.owner_setup as setup
    join public.sop_records as action on action.owner_id = setup.owner_id
    where setup.owner_id = '00000000-0000-4000-8000-00000000006a'
      and action.is_monthly_action
  $$,
  $$
    select behavior_activated_at, false, null::timestamptz
    from first_behavior_activation
  $$,
  'reopening clears only action completion and keeps Behavior Activation evidence'
);

select results_eq(
  $$
    select status
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000006a'
      and is_plan_path
      and year_month = to_char(
        date_trunc('month', current_timestamp at time zone 'Asia/Singapore'),
        'YYYY-MM'
      )
  $$,
  $$ values ('pending'::text) $$,
  'reopening returns the current Plan Path to pending'
);

update public.monthly_milestones
set actual_savings = 33, actual_total_savings = 1033
where owner_id = '00000000-0000-4000-8000-00000000006a'
  and is_plan_path
  and year_month = to_char(
    date_trunc('month', current_timestamp at time zone 'Asia/Singapore'),
    'YYYY-MM'
  );

select results_eq(
  $$
    select
      (result.payload ->> 'completed')::boolean,
      (result.payload ->> 'behavior_activated_now')::boolean
    from (
      select public.update_monthly_action(
        (
          select id
          from public.sop_records
          where owner_id = '00000000-0000-4000-8000-00000000006a'
            and is_monthly_action
        ),
        '{"completed":true}'::jsonb
      ) as payload
    ) as result
  $$,
  $$ values (true, false) $$,
  'completing a reopened action keeps Behavior Activation idempotent'
);

select results_eq(
  $$
    select behavior_activated_at
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000006a'
  $$,
  $$ select behavior_activated_at from first_behavior_activation $$,
  'later completions preserve the first Behavior Activation timestamp'
);

select results_eq(
  $$
    select status, actual_savings, actual_total_savings
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000006a'
      and is_plan_path
      and year_month = to_char(
        date_trunc('month', current_timestamp at time zone 'Asia/Singapore'),
        'YYYY-MM'
      )
  $$,
  $$ values ('on_track'::text, 33.00::numeric, 1033.00::numeric) $$,
  'Monthly Action completion updates execution status without changing Net Worth fields'
);

select is(
  (
    select count(*)
    from public.salary_configs
    where owner_id = '00000000-0000-4000-8000-00000000006a'
  ),
  0::bigint,
  'Behavior Activation has no SalaryConfig dependency'
);

create temporary table owner_a_monthly_action as
select id
from public.sop_records
where owner_id = '00000000-0000-4000-8000-00000000006a'
  and is_monthly_action;

reset role;

update public.owner_setup
set plan_activated_at = current_timestamp
where owner_id = '00000000-0000-4000-8000-00000000006b';

insert into public.sop_records (
  id, owner_id, year_month, template_id, step_key, step_label,
  due_day, completed, amount, counts_toward_milestone, milestone_amount,
  is_monthly_action, rule_amount, scheduled_for
) values (
  '80000000-0000-4000-8000-00000000006b',
  '00000000-0000-4000-8000-00000000006b',
  '2000-01',
  null,
  'historical_monthly_action',
  'Historical Monthly Action',
  1,
  false,
  10,
  true,
  10,
  true,
  10,
  '2000-01-01'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000006b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000006b","role":"authenticated"}';

select throws_ok(
  $$
    select public.update_monthly_action(
      (select id from owner_a_monthly_action),
      '{"completed":false}'::jsonb
    )
  $$,
  'P0001', null,
  'owner B cannot complete owner A Monthly Action through the definer RPC'
);

select lives_ok(
  $$
    select public.update_monthly_action(
      '80000000-0000-4000-8000-00000000006b',
      '{"completed":true}'::jsonb
    )
  $$,
  'owner B can preserve a historical Monthly Action confirmation'
);

select is(
  (
    select behavior_activated_at
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000006b'
  ),
  null::timestamptz,
  'historical Monthly Action confirmation does not emit Behavior Activation'
);

select lives_ok(
  $$
    select public.save_plan_rule(
      '{
        "rule_id":"20000000-0000-4000-8000-000000000062",
        "name":"Rollback reserve",
        "amount":"75.00",
        "due_day":15,
        "source_account_id":null,
        "target_account_id":"10000000-0000-4000-8000-00000000006b"
      }'::jsonb
    )
  $$,
  'owner B can prepare the rollback scenario without SalaryConfig'
);

select lives_ok(
  $$ select public.activate_savings_plan() $$,
  'owner B can activate the rollback scenario'
);

delete from public.balance_snapshots
where account_id = '10000000-0000-4000-8000-00000000006b';

select throws_ok(
  $$
    select public.update_monthly_action(
      (
        select id
        from public.sop_records
        where owner_id = '00000000-0000-4000-8000-00000000006b'
          and is_monthly_action
          and template_id = '20000000-0000-4000-8000-000000000062'
      ),
      '{"completed":true}'::jsonb
    )
  $$,
  'P0001', null,
  'a Plan Path projector failure aborts Monthly Action completion'
);

select results_eq(
  $$
    select
      action.completed,
      action.completed_at,
      setup.behavior_activated_at,
      milestone.status
    from public.sop_records as action
    join public.owner_setup as setup on setup.owner_id = action.owner_id
    join public.monthly_milestones as milestone
      on milestone.owner_id = action.owner_id
      and milestone.year_month = action.year_month
      and milestone.is_plan_path
    where action.owner_id = '00000000-0000-4000-8000-00000000006b'
      and action.is_monthly_action
      and action.template_id = '20000000-0000-4000-8000-000000000062'
  $$,
  $$ values (false, null::timestamptz, null::timestamptz, 'pending'::text) $$,
  'projector failure rolls back action, Behavior Activation, and Plan Path status'
);

select * from finish();

rollback;
