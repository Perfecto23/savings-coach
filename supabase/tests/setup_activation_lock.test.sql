begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(4);

select has_function(
  'public',
  'protect_activated_setup_fields',
  array[]::text[],
  'Activated Setup fields have a database trigger function'
);

select is(
  (
    select count(*)
    from pg_trigger
    where tgrelid = 'public.owner_setup'::regclass
      and tgname = 'owner_setup_lock_activated_fields'
      and not tgenabled = 'D'
  ),
  1::bigint,
  'Activated Setup lock trigger is enabled'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-00000000012a',
  'authenticated', 'authenticated', 'setup-lock@example.invalid', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.accounts (id, owner_id, name, bank, purpose)
values (
  '10000000-0000-4000-8000-00000000012a',
  '00000000-0000-4000-8000-00000000012a',
  'Locked Savings', null, 'savings'
);

insert into public.owner_setup (
  owner_id, locale, time_zone, base_currency, savings_account_id,
  plan_activated_at
) values (
  '00000000-0000-4000-8000-00000000012a',
  'zh-CN', 'Asia/Shanghai', 'CNY',
  '10000000-0000-4000-8000-00000000012a', now()
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000012a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000012a","role":"authenticated"}';

select throws_ok(
  $$update public.owner_setup set time_zone = 'UTC' where owner_id = '00000000-0000-4000-8000-00000000012a'$$,
  'P0001',
  'activated_setup_locked',
  'Activated owner cannot change time zone'
);

select throws_ok(
  $$update public.owner_setup set savings_account_id = null where owner_id = '00000000-0000-4000-8000-00000000012a'$$,
  'P0001',
  'activated_setup_locked',
  'Activated owner cannot change savings account'
);

select * from finish();
rollback;
