begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

select has_column(
  'public', 'owner_setup', 'paid_intent_offer_code',
  'Paid Intent stores its frozen offer code on owner_setup'
);

select has_column(
  'public', 'owner_setup', 'paid_intent_recorded_at',
  'Paid Intent stores its first recorded timestamp on owner_setup'
);

select has_function(
  'public', 'get_paid_intent_offer_state', array[]::text[],
  'get_paid_intent_offer_state() is the safe read seam'
);

select has_function(
  'public', 'record_paid_intent', array[]::text[],
  'record_paid_intent() is the idempotent command seam'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.owner_setup'::regclass
      and conname = 'owner_setup_paid_intent_pair_check'
      and pg_get_constraintdef(oid) like '%pro_beta_usd_499_monthly_v1%'
  ),
  1::bigint,
  'Paid Intent CHECK freezes the released offer and paired timestamp'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'get_paid_intent_offer_state', 'record_paid_intent'
      )
      and procedure.pronargs = 0
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
  'Paid Intent seams are zero-argument authenticated definer functions'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.owner_setup', 'paid_intent_offer_code', 'INSERT'
  )
    and not has_column_privilege(
      'authenticated', 'public.owner_setup', 'paid_intent_offer_code', 'UPDATE'
    )
    and not has_column_privilege(
      'authenticated', 'public.owner_setup', 'paid_intent_recorded_at', 'INSERT'
    )
    and not has_column_privilege(
      'authenticated', 'public.owner_setup', 'paid_intent_recorded_at', 'UPDATE'
    ),
  'authenticated clients cannot write Paid Intent fields directly'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'subscriptions', 'entitlements', 'billing', 'payments',
        'checkout_sessions', 'paid_intent_events'
      )
  ),
  0::bigint,
  'Paid Intent beta adds no billing, entitlement, payment, checkout, or event table'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-8000-00000000010a', 'authenticated', 'authenticated', 'intent-a@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000000010b', 'authenticated', 'authenticated', 'intent-b@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000000010c', 'authenticated', 'authenticated', 'intent-c@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.owner_setup (
  owner_id, locale, time_zone, base_currency
) values
  ('00000000-0000-4000-8000-00000000010a', 'en-SG', 'Asia/Singapore', 'SGD'),
  ('00000000-0000-4000-8000-00000000010b', 'en-US', 'America/New_York', 'USD');

insert into public.monthly_milestones (
  owner_id, year_month, planned_savings, planned_total_savings,
  status, is_plan_path, review_completed_at
) values (
  '00000000-0000-4000-8000-00000000010a',
  to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM'),
  100, 1000, 'on_track', true, current_timestamp
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000010a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000010a","role":"authenticated"}';

select results_eq(
  $$
    select
      state.payload ->> 'offer_code',
      (state.payload ->> 'eligible')::boolean,
      state.payload ->> 'recorded_at'
    from (select public.get_paid_intent_offer_state() as payload) as state
  $$,
  $$ values ('pro_beta_usd_499_monthly_v1'::text, true, null::text) $$,
  'owner A completed Monthly Review exposes the fixed eligible offer'
);

select results_eq(
  $$
    select distinct state_key
    from jsonb_object_keys(public.get_paid_intent_offer_state()) as state_key
    order by state_key
  $$,
  $$ values ('eligible'::text), ('offer_code'::text), ('recorded_at'::text) $$,
  'Paid Intent read state exposes only the safe field allowlist'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000010b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000010b","role":"authenticated"}';

select results_eq(
  $$
    select
      (state.payload ->> 'eligible')::boolean,
      state.payload ->> 'recorded_at'
    from (select public.get_paid_intent_offer_state() as payload) as state
  $$,
  $$ values (false, null::text) $$,
  'owner B cannot inherit owner A Monthly Review eligibility or intent'
);

select throws_ok(
  $$ select public.record_paid_intent() $$,
  'P0001', 'paid_intent_not_eligible',
  'owner B cannot record intent without a completed Monthly Review'
);

select results_eq(
  $$
    select paid_intent_offer_code, paid_intent_recorded_at
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000010b'
  $$,
  $$ values (null::text, null::timestamptz) $$,
  'rejected owner B intent writes no Paid Intent fields'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000010a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000010a","role":"authenticated"}';

select results_eq(
  $$
    select
      receipt.payload ->> 'offer_code',
      (receipt.payload ->> 'recorded_at') is not null,
      (receipt.payload ->> 'recorded_now')::boolean
    from (select public.record_paid_intent() as payload) as receipt
  $$,
  $$ values ('pro_beta_usd_499_monthly_v1'::text, true, true) $$,
  'first eligible CTA records the fixed Paid Intent receipt'
);

create temporary table first_paid_intent as
select paid_intent_offer_code, paid_intent_recorded_at
from public.owner_setup
where owner_id = '00000000-0000-4000-8000-00000000010a';

select results_eq(
  $$
    select paid_intent_offer_code, paid_intent_recorded_at
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000010a'
  $$,
  $$ select paid_intent_offer_code, paid_intent_recorded_at from first_paid_intent $$,
  'owner_setup stores the fixed Paid Intent code and first timestamp'
);

select results_eq(
  $$
    select
      (receipt.payload ->> 'recorded_at')::timestamptz,
      (receipt.payload ->> 'recorded_now')::boolean
    from (select public.record_paid_intent() as payload) as receipt
  $$,
  $$ select paid_intent_recorded_at, false from first_paid_intent $$,
  'repeating Paid Intent preserves the first receipt and reports idempotency'
);

select results_eq(
  $$
    select distinct receipt_key
    from jsonb_object_keys(public.record_paid_intent()) as receipt_key
    order by receipt_key
  $$,
  $$ values ('offer_code'::text), ('recorded_at'::text), ('recorded_now'::text) $$,
  'Paid Intent receipt exposes only the safe field allowlist'
);

select results_eq(
  $$
    select
      state.payload ->> 'offer_code',
      (state.payload ->> 'eligible')::boolean,
      (state.payload ->> 'recorded_at')::timestamptz
    from (select public.get_paid_intent_offer_state() as payload) as state
  $$,
  $$
    select paid_intent_offer_code, true, paid_intent_recorded_at
    from first_paid_intent
  $$,
  'Paid Intent read state returns the durable recorded receipt'
);

select throws_ok(
  $$
    update public.owner_setup
    set
      paid_intent_offer_code = 'pro_beta_usd_499_monthly_v1',
      paid_intent_recorded_at = current_timestamp
    where owner_id = '00000000-0000-4000-8000-00000000010a'
  $$,
  '42501', null,
  'authenticated clients cannot update Paid Intent fields directly'
);

select throws_ok(
  $$
    insert into public.owner_setup (
      owner_id, locale, time_zone, base_currency,
      paid_intent_offer_code, paid_intent_recorded_at
    ) values (
      '00000000-0000-4000-8000-00000000010c',
      'en-US', 'UTC', 'USD',
      'pro_beta_usd_499_monthly_v1', current_timestamp
    )
  $$,
  '42501', null,
  'authenticated clients cannot direct-insert Paid Intent fields'
);

reset role;

select throws_ok(
  $$
    update public.owner_setup
    set
      paid_intent_offer_code = 'other_offer',
      paid_intent_recorded_at = current_timestamp
    where owner_id = '00000000-0000-4000-8000-00000000010b'
  $$,
  '23514', null,
  'Paid Intent CHECK rejects any non-frozen offer code'
);

select throws_ok(
  $$
    update public.owner_setup
    set
      paid_intent_offer_code = null,
      paid_intent_recorded_at = current_timestamp
    where owner_id = '00000000-0000-4000-8000-00000000010b'
  $$,
  '23514', null,
  'Paid Intent CHECK rejects an unpaired timestamp'
);

select throws_ok(
  $$
    update public.owner_setup
    set
      paid_intent_offer_code = 'pro_beta_usd_499_monthly_v1',
      paid_intent_recorded_at = null
    where owner_id = '00000000-0000-4000-8000-00000000010b'
  $$,
  '23514', null,
  'Paid Intent CHECK rejects an unpaired offer code'
);

select is(
  (
    select
      (select count(*) from public.salary_configs where owner_id = '00000000-0000-4000-8000-00000000010a')
      + (select count(*) from public.balance_snapshots)
      + (select count(*) from public.sop_templates where owner_id = '00000000-0000-4000-8000-00000000010a')
  ),
  0::bigint,
  'Paid Intent eligibility has no SalaryConfig, Balance Snapshot, or Plan Rule dependency'
);

select is(
  (
    select count(*)
    from public.owner_setup
    where paid_intent_offer_code is not null
      and paid_intent_recorded_at is not null
  ),
  1::bigint,
  'A/B isolation leaves exactly one eligible owner receipt'
);

select * from finish();

rollback;
