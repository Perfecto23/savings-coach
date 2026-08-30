begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(59);

-- ---------------------------------------------------------------------------
-- Catalog contract
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.owner_setup') is not null,
  'owner_setup exists as the Setup checkpoint store'
);

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'owner_setup'
      and relation.relrowsecurity
  ),
  1::bigint,
  'owner_setup has row-level security enabled'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_setup'
      and column_name in (
        'owner_id',
        'locale',
        'time_zone',
        'base_currency',
        'savings_account_id',
        'created_at',
        'updated_at'
      )
  ),
  7::bigint,
  'owner_setup exposes only the frozen persisted fields'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_row
    join pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral unnest(constraint_row.conkey) as key(attnum)
    join pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = key.attnum
    where namespace.nspname = 'public'
      and relation.relname = 'owner_setup'
      and constraint_row.contype = 'p'
      and attribute.attname = 'owner_id'
  ),
  1::bigint,
  'owner_setup stores at most one checkpoint per owner'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_row
    join pg_class as child_relation on child_relation.oid = constraint_row.conrelid
    join pg_namespace as child_namespace on child_namespace.oid = child_relation.relnamespace
    join pg_class as parent_relation on parent_relation.oid = constraint_row.confrelid
    join pg_namespace as parent_namespace on parent_namespace.oid = parent_relation.relnamespace
    cross join lateral unnest(constraint_row.conkey) as key(attnum)
    join pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = key.attnum
    where child_namespace.nspname = 'public'
      and child_relation.relname = 'owner_setup'
      and parent_namespace.nspname = 'auth'
      and parent_relation.relname = 'users'
      and constraint_row.contype = 'f'
      and constraint_row.confdeltype = 'r'
      and attribute.attname = 'owner_id'
  ),
  1::bigint,
  'owner_setup restricts implicit deletion of an Auth user'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_row
    join pg_class as child_relation on child_relation.oid = constraint_row.conrelid
    join pg_namespace as child_namespace on child_namespace.oid = child_relation.relnamespace
    join pg_class as parent_relation on parent_relation.oid = constraint_row.confrelid
    join pg_namespace as parent_namespace on parent_namespace.oid = parent_relation.relnamespace
    cross join lateral (
      select string_agg(attribute.attname, ',' order by key.ordinality) as column_names
      from unnest(constraint_row.conkey) with ordinality as key(attnum, ordinality)
      join pg_attribute as attribute
        on attribute.attrelid = constraint_row.conrelid
        and attribute.attnum = key.attnum
    ) as child_columns
    cross join lateral (
      select string_agg(attribute.attname, ',' order by key.ordinality) as column_names
      from unnest(constraint_row.confkey) with ordinality as key(attnum, ordinality)
      join pg_attribute as attribute
        on attribute.attrelid = constraint_row.confrelid
        and attribute.attnum = key.attnum
    ) as parent_columns
    where child_namespace.nspname = 'public'
      and child_relation.relname = 'owner_setup'
      and parent_namespace.nspname = 'public'
      and parent_relation.relname = 'accounts'
      and constraint_row.contype = 'f'
      and child_columns.column_names = 'owner_id,savings_account_id'
      and parent_columns.column_names = 'owner_id,id'
  ),
  1::bigint,
  'linked savings accounts must belong to the same owner'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_row
    join pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    join pg_attribute as nulled_column
      on nulled_column.attrelid = constraint_row.conrelid
      and nulled_column.attnum = constraint_row.confdelsetcols[1]
    where namespace.nspname = 'public'
      and relation.relname = 'owner_setup'
      and constraint_row.contype = 'f'
      and constraint_row.confdeltype = 'n'
      and cardinality(constraint_row.confdelsetcols) = 1
      and nulled_column.attname = 'savings_account_id'
  ),
  1::bigint,
  'deleting a linked account nulls only savings_account_id'
);

select is(
  (
    select is_nullable::text
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'bank'
  ),
  'YES'::text,
  'institution is optional at the database boundary'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'owner_setup'
      and column_name in ('is_complete', 'setup_completed_at', 'completed_at')
  ),
  0::bigint,
  'Setup completion is derived instead of stored'
);

select is(
  (
    select count(distinct cmd)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_setup'
      and cmd in ('INSERT', 'SELECT', 'UPDATE')
  ),
  3::bigint,
  'owner_setup exposes owner-scoped select, insert, and update policies only'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_setup'
      and roles = array['authenticated']::name[]
      and case cmd
        when 'SELECT' then qual ~ 'auth\.uid\(\).*owner_id' and with_check is null
        when 'INSERT' then qual is null and with_check ~ 'auth\.uid\(\).*owner_id'
        when 'UPDATE' then qual ~ 'auth\.uid\(\).*owner_id'
          and with_check ~ 'auth\.uid\(\).*owner_id'
        else false
      end
  ),
  3::bigint,
  'owner_setup policies bind both old and new rows to auth.uid'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'owner_setup'
      and grantee = 'anon'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  0::bigint,
  'anonymous clients have no owner_setup CRUD grants'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'owner_setup'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ),
  1::bigint,
  'authenticated clients have only the released owner_setup table grant'
);

select is(
  (
    select string_agg(
      privilege_type || ':' || column_name,
      ',' order by privilege_type, column_name
    )
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'owner_setup'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE')
  ),
  'INSERT:base_currency,INSERT:locale,INSERT:owner_id,INSERT:savings_account_id,INSERT:time_zone,UPDATE:base_currency,UPDATE:locale,UPDATE:savings_account_id,UPDATE:time_zone',
  'authenticated clients can write Setup fields but not plan activation evidence'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'owner_setup'
      and grantee = 'authenticated'
      and privilege_type = 'DELETE'
  ),
  0::bigint,
  'owner_setup has no direct delete grant'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'save_owner_setup_step'
      and procedure.pronargs = 2
      and procedure.proargtypes
        = array['text'::regtype::oid, 'jsonb'::regtype::oid]::oidvector
      and procedure.prorettype = 'jsonb'::regtype
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not has_function_privilege('anon', procedure.oid, 'EXECUTE')
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, array[]::text[])) as setting
        where setting like 'search_path=%'
      )
      and not exists (
        select 1
        from unnest(coalesce(procedure.proargnames, array[]::text[])) as argument_name
        where argument_name in ('owner_id', 'p_owner_id')
      )
  ),
  1::bigint,
  'save_owner_setup_step is the fixed, owner-safe definer RPC seam'
);

-- ---------------------------------------------------------------------------
-- Two invited owners exercise the staged public RPC and table interfaces.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-00000000004a',
    'authenticated',
    'authenticated',
    'setup-owner-a@example.invalid',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000004b',
    'authenticated',
    'authenticated',
    'setup-owner-b@example.invalid',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{
        "locale":"en-SG",
        "time_zone":"Asia/Singapore",
        "base_currency":"SGD",
        "owner_id":"00000000-0000-4000-8000-00000000004b"
      }'::jsonb
    )
  $$,
  'owner A can save preferences and a spoofed payload owner is ignored'
);

select results_eq(
  $$
    select owner_id, locale, time_zone, base_currency, savings_account_id
    from public.owner_setup
  $$,
  $$
    values (
      '00000000-0000-4000-8000-00000000004a'::uuid,
      'en-SG'::text,
      'Asia/Singapore'::text,
      'SGD'::text,
      null::uuid
    )
  $$,
  'preferences persist under the authenticated owner without an account link'
);

select throws_ok(
  $$
    insert into public.owner_setup (owner_id, locale, time_zone, base_currency)
    values (
      '00000000-0000-4000-8000-00000000004b',
      'en-SG',
      'Asia/Singapore',
      'SGD'
    )
  $$,
  '42501',
  null,
  'owner A cannot insert owner B checkpoint directly'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"xx-INVALID","time_zone":"Asia/Singapore","base_currency":"SGD"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'unsupported locale is rejected'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-SG","time_zone":"Mars/Olympus","base_currency":"SGD"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'unknown IANA timezone is rejected'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-SG","time_zone":"Asia/Singapore","base_currency":"JPY"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'zero-decimal currency is outside the supported currency list'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-SG","time_zone":"Asia/Singapore","base_currency":"KWD"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'three-decimal currency is outside the supported currency list'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004b","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-US","time_zone":"America/New_York","base_currency":"USD"}'::jsonb
    )
  $$,
  'owner B can independently save supported preferences'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004a","role":"authenticated"}';

select results_eq(
  $$ select owner_id from public.owner_setup order by owner_id $$,
  $$ values ('00000000-0000-4000-8000-00000000004a'::uuid) $$,
  'owner A unfiltered checkpoint list excludes owner B'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004b","role":"authenticated"}';

select is_empty(
  $$
    select owner_id
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000004a'
  $$,
  'owner B cannot read owner A checkpoint by ID'
);

-- ---------------------------------------------------------------------------
-- Step 2 creates or attaches one owned savings account without duplication.
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'savings_account',
      '{"mode":"create","name":"Rainy Day Fund","institution":null}'::jsonb
    )
  $$,
  'owner A can create the Setup savings account without an institution'
);

select results_eq(
  $$
    select account.name, account.bank, account.purpose
    from public.owner_setup as setup
    join public.accounts as account
      on account.owner_id = setup.owner_id
      and account.id = setup.savings_account_id
  $$,
  $$ values ('Rainy Day Fund'::text, null::text, 'savings'::text) $$,
  'the created account has the requested name, null institution, and fixed savings purpose'
);

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'savings_account',
      '{"mode":"create","name":"Rainy Day Fund","institution":null}'::jsonb
    )
  $$,
  'retrying a lost Step 2 response succeeds'
);

select is(
  (
    select count(*)
    from public.accounts
    where name = 'Rainy Day Fund'
  ),
  1::bigint,
  'retrying Step 2 does not create a duplicate account'
);

select results_eq(
  $$
    select exists (
      select 1
      from public.owner_setup as setup
      join public.accounts as account
        on account.owner_id = setup.owner_id
        and account.id = setup.savings_account_id
        and account.purpose = 'savings'
      join public.balance_snapshots as snapshot on snapshot.account_id = account.id
      where setup.owner_id = '00000000-0000-4000-8000-00000000004a'
    )
  $$,
  $$ values (false) $$,
  'a linked savings account without a snapshot does not complete Setup'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004b","role":"authenticated"}';

select lives_ok(
  $$
    do $legacy_fixture$
    begin
      insert into public.accounts (id, owner_id, name, bank, purpose)
      values (
        '10000000-0000-4000-8000-00000000004b',
        '00000000-0000-4000-8000-00000000004b',
        'Legacy Savings',
        null,
        'savings'
      );

      insert into public.accounts (id, owner_id, name, bank, purpose)
      values (
        '11000000-0000-4000-8000-00000000004b',
        '00000000-0000-4000-8000-00000000004b',
        'Legacy Spending',
        null,
        'flexible'
      );

    end;
    $legacy_fixture$
  $$,
  'owner B can have legacy savings and non-savings account fixtures'
);

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'savings_account',
      '{"mode":"attach","savings_account_id":"10000000-0000-4000-8000-00000000004b"}'::jsonb
    )
  $$,
  'owner B can attach an existing owned savings account'
);

select results_eq(
  $$
    select savings_account_id
    from public.owner_setup
  $$,
  $$ values ('10000000-0000-4000-8000-00000000004b'::uuid) $$,
  'owner B checkpoint links the selected legacy savings account'
);

select results_eq(
  $$
    select (
      public.save_owner_setup_step(
        'initial_balance',
        jsonb_build_object(
          'balance', '2500.00',
          'recorded_at',
          (current_timestamp at time zone 'America/New_York')::date
        )
      ) -> 'initial_balance' ->> 'balance'
    )::numeric
  $$,
  $$ values (2500.00::numeric) $$,
  'owner B creates the first Balance Snapshot through the Setup RPC'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'savings_account',
      '{"mode":"attach","savings_account_id":"10000000-0000-4000-8000-00000000004a"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'owner B cannot attach owner A savings account'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'savings_account',
      '{"mode":"attach","savings_account_id":"11000000-0000-4000-8000-00000000004b"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'owner B cannot attach a non-savings account'
);

select throws_ok(
  $$
    update public.accounts
    set purpose = 'flexible'
    where id = '10000000-0000-4000-8000-00000000004b'
  $$,
  'P0001',
  null,
  'a linked Setup account cannot change away from savings purpose'
);

-- ---------------------------------------------------------------------------
-- Step 3 is idempotent, detects conflicts, and derives completion.
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004a","role":"authenticated"}';

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      '{"balance":1234.56,"recorded_at":"2026-08-30"}'::jsonb
    )
  $$,
  'owner A can save the first balance snapshot'
);

select results_eq(
  $$
    select exists (
      select 1
      from public.owner_setup as setup
      join public.accounts as account
        on account.owner_id = setup.owner_id
        and account.id = setup.savings_account_id
        and account.purpose = 'savings'
      join public.balance_snapshots as snapshot on snapshot.account_id = account.id
      where setup.owner_id = '00000000-0000-4000-8000-00000000004a'
    )
  $$,
  $$ values (true) $$,
  'preferences, a valid linked savings account, and a snapshot complete Setup'
);

select results_eq(
  $$
    select snapshot.balance, snapshot.recorded_at
    from public.owner_setup as setup
    join public.balance_snapshots as snapshot
      on snapshot.account_id = setup.savings_account_id
    where setup.owner_id = '00000000-0000-4000-8000-00000000004a'
  $$,
  $$ values (1234.56::numeric, '2026-08-30'::date) $$,
  'the first snapshot preserves the submitted balance and date'
);

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      '{"balance":1234.56,"recorded_at":"2026-08-30"}'::jsonb
    )
  $$,
  'retrying the same first balance succeeds as a no-op'
);

select is(
  (
    select count(*)
    from public.owner_setup as setup
    join public.balance_snapshots as snapshot
      on snapshot.account_id = setup.savings_account_id
    where setup.owner_id = '00000000-0000-4000-8000-00000000004a'
      and snapshot.recorded_at = '2026-08-30'
  ),
  1::bigint,
  'retrying the same first balance does not duplicate a snapshot'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      '{"balance":9999.99,"recorded_at":"2026-08-30"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'same-date different-balance retry is rejected as a conflict'
);

select results_eq(
  $$
    select snapshot.balance
    from public.owner_setup as setup
    join public.balance_snapshots as snapshot
      on snapshot.account_id = setup.savings_account_id
    where setup.owner_id = '00000000-0000-4000-8000-00000000004a'
      and snapshot.recorded_at = '2026-08-30'
  $$,
  $$ values (1234.56::numeric) $$,
  'a conflicting retry does not overwrite the original balance'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'initial_balance',
      '{"balance":1234.56,"recorded_at":"2099-05-01"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'a future balance date is rejected in the saved time zone'
);

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000004a'
  ),
  0::bigint,
  'Setup completion does not create a monthly milestone'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-SG","time_zone":"Asia/Singapore","base_currency":"USD"}'::jsonb
    )
  $$,
  'P0001',
  null,
  'base currency cannot change after the owner has a balance snapshot'
);

select results_eq(
  $$ select base_currency from public.owner_setup $$,
  $$ values ('SGD'::text) $$,
  'a rejected currency change preserves the original base currency'
);

select lives_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-US","time_zone":"America/New_York","base_currency":"SGD"}'::jsonb
    )
  $$,
  'locale and timezone remain editable after Setup completion'
);

select results_eq(
  $$ select locale, time_zone from public.owner_setup $$,
  $$ values ('en-US'::text, 'America/New_York'::text) $$,
  'editable preferences persist without changing base currency'
);

-- ---------------------------------------------------------------------------
-- Deleting Setup dependencies derives the first incomplete step again.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    delete from public.accounts
    where id = (
      select savings_account_id
      from public.owner_setup
      where owner_id = '00000000-0000-4000-8000-00000000004a'
    )
  $$,
  'P0001', null,
  'owner A cannot delete the linked savings account'
);

select ok(
  (
    select savings_account_id is not null
    from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000004a'
  ),
  'a rejected linked-account deletion preserves the Setup account link'
);

select results_eq(
  $$
    select exists (
      select 1
      from public.owner_setup as setup
      join public.accounts as account
        on account.owner_id = setup.owner_id
        and account.id = setup.savings_account_id
        and account.purpose = 'savings'
      join public.balance_snapshots as snapshot on snapshot.account_id = account.id
      where setup.owner_id = '00000000-0000-4000-8000-00000000004a'
    )
  $$,
  $$ values (true) $$,
  'a rejected linked-account deletion preserves Setup completeness'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004b","role":"authenticated"}';

select throws_ok(
  $$
    select public.delete_balance_observations(
      (current_timestamp at time zone 'America/New_York')::date
    )
  $$,
  'P0001', null,
  'owner B cannot delete the last Setup-linked Balance Observation'
);

select results_eq(
  $$
    select exists (
      select 1
      from public.owner_setup as setup
      join public.accounts as account
        on account.owner_id = setup.owner_id
        and account.id = setup.savings_account_id
        and account.purpose = 'savings'
      join public.balance_snapshots as snapshot on snapshot.account_id = account.id
      where setup.owner_id = '00000000-0000-4000-8000-00000000004b'
    )
  $$,
  $$ values (true) $$,
  'a rejected last-observation deletion preserves owner B Setup completeness'
);

-- ---------------------------------------------------------------------------
-- Anonymous access and direct deletion stay outside the released seam.
-- ---------------------------------------------------------------------------

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.owner_setup $$,
  '42501',
  null,
  'anonymous clients cannot read Setup checkpoints'
);

select throws_ok(
  $$
    select public.save_owner_setup_step(
      'preferences',
      '{"locale":"en-SG","time_zone":"Asia/Singapore","base_currency":"SGD"}'::jsonb
    )
  $$,
  '42501',
  null,
  'anonymous clients cannot execute Setup checkpoint writes'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000004a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000004a","role":"authenticated"}';

select throws_ok(
  $$
    delete from public.owner_setup
    where owner_id = '00000000-0000-4000-8000-00000000004a'
  $$,
  '42501',
  null,
  'authenticated users cannot delete Setup checkpoints directly'
);

select * from finish();
rollback;
