begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(82);

-- ---------------------------------------------------------------------------
-- Catalog contract
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'balance_snapshots',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_messages',
        'ai_configs',
        'impulse_logs'
      ])
      and relation.relrowsecurity
  ),
  11::bigint,
  'all business tables have row-level security enabled'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_configs',
        'impulse_logs'
      ])
      and column_name = 'owner_id'
  ),
  9::bigint,
  'all direct-owner tables expose owner_id'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_configs',
        'impulse_logs'
      ])
      and column_name = 'owner_id'
      and is_nullable = 'NO'
  ),
  9::bigint,
  'direct-owner columns reject null ownership'
);

select is(
  (
    select count(*)
    from pg_attribute as attribute
    join pg_class as relation on relation.oid = attribute.attrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    join pg_attrdef as default_value
      on default_value.adrelid = relation.oid
      and default_value.adnum = attribute.attnum
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_configs',
        'impulse_logs'
      ])
      and attribute.attname = 'owner_id'
      and pg_get_expr(default_value.adbin, default_value.adrelid) ~ 'auth\.uid\(\)'
  ),
  9::bigint,
  'direct-owner inserts derive owner_id from the authenticated user'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('balance_snapshots', 'ai_messages')
      and column_name = 'owner_id'
  ),
  0::bigint,
  'single-parent child tables derive ownership instead of duplicating owner_id'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and policyname = 'Authenticated access'
  ),
  0::bigint,
  'the legacy all-authenticated policy is absent'
);

select is(
  (
    select count(*)
    from (
      select tablename
      from pg_policies
      where schemaname = 'public'
        and tablename = any (array[
          'accounts',
          'salary_configs',
          'bonus_events',
          'monthly_milestones',
          'sop_templates',
          'sop_records',
          'ai_conversations',
          'ai_configs',
          'impulse_logs'
        ])
      group by tablename
      having array_agg(distinct cmd order by cmd)
        = array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[]
    ) as covered_direct_tables
  ),
  9::bigint,
  'every direct-owner table has policies for all four CRUD commands'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_configs',
        'impulse_logs'
      ])
      and roles = array['authenticated']::name[]
      and case cmd
        when 'SELECT' then qual ~ 'auth\.uid\(\).*owner_id' and with_check is null
        when 'INSERT' then qual is null and with_check ~ 'auth\.uid\(\).*owner_id'
        when 'UPDATE' then qual ~ 'auth\.uid\(\).*owner_id'
          and with_check ~ 'auth\.uid\(\).*owner_id'
        when 'DELETE' then qual ~ 'auth\.uid\(\).*owner_id' and with_check is null
        else false
      end
  ),
  36::bigint,
  'direct-owner policies target authenticated users and enforce auth.uid ownership'
);

select is(
  (
    select count(*)
    from (
      select tablename
      from pg_policies
      where schemaname = 'public'
        and tablename in ('balance_snapshots', 'ai_messages')
      group by tablename
      having array_agg(distinct cmd order by cmd)
        = array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[]
    ) as covered_child_tables
  ),
  2::bigint,
  'every parent-derived child table has policies for all four CRUD commands'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and table_name = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'balance_snapshots',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_messages',
        'ai_configs',
        'impulse_logs'
      ])
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  0::bigint,
  'anonymous clients have no business-table CRUD grants'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and table_name = any (array[
        'accounts',
        'salary_configs',
        'bonus_events',
        'monthly_milestones',
        'balance_snapshots',
        'sop_templates',
        'sop_records',
        'ai_conversations',
        'ai_messages',
        'ai_configs',
        'impulse_logs'
      ])
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  40::bigint,
  'authenticated clients retain CRUD grants only on the ten released business tables'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'ai_configs'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ),
  0::bigint,
  'Consumer BYOK stays inaccessible through the Data API'
);

select is(
  (
    select count(*)
    from (
    select string_agg(attribute.attname, ',' order by key.ordinality)
    from pg_constraint as constraint_row
    cross join lateral unnest(constraint_row.conkey)
      with ordinality as key(attnum, ordinality)
    join pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = key.attnum
    where constraint_row.conrelid = 'public.monthly_milestones'::regclass
      and constraint_row.contype = 'u'
    group by constraint_row.oid
    having string_agg(attribute.attname, ',' order by key.ordinality)
      = 'owner_id,year_month'
    ) as matching_constraints
  ),
  1::bigint,
  'monthly milestone uniqueness is owner-scoped'
);

select is(
  (
    select count(*)
    from (
    select string_agg(attribute.attname, ',' order by key.ordinality)
    from pg_constraint as constraint_row
    cross join lateral unnest(constraint_row.conkey)
      with ordinality as key(attnum, ordinality)
    join pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = key.attnum
    where constraint_row.conrelid = 'public.sop_templates'::regclass
      and constraint_row.contype = 'u'
    group by constraint_row.oid
    having string_agg(attribute.attname, ',' order by key.ordinality)
      = 'owner_id,step_key'
    ) as matching_constraints
  ),
  1::bigint,
  'SOP template uniqueness is owner-scoped'
);

select is(
  (
    select count(*)
    from (
    select string_agg(attribute.attname, ',' order by key.ordinality)
    from pg_constraint as constraint_row
    cross join lateral unnest(constraint_row.conkey)
      with ordinality as key(attnum, ordinality)
    join pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = key.attnum
    where constraint_row.conrelid = 'public.sop_records'::regclass
      and constraint_row.contype = 'u'
    group by constraint_row.oid
    having string_agg(attribute.attname, ',' order by key.ordinality)
      = 'owner_id,year_month,step_key'
    ) as matching_constraints
  ),
  1::bigint,
  'monthly SOP step uniqueness is owner-scoped'
);

select is(
  (
    select count(*)
    from (
      select format(
      '%s:%s->%s:%s',
      child_relation.relname,
      child_columns.column_names,
      parent_relation.relname,
      parent_columns.column_names
    )
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
    where constraint_row.contype = 'f'
      and child_namespace.nspname = 'public'
      and parent_namespace.nspname = 'public'
      and child_columns.column_names in (
        'owner_id,target_account_id',
        'owner_id,from_account_id',
        'owner_id,to_account_id',
        'owner_id,template_id'
      )
    ) as owner_links(link_definition)
    where link_definition = any (array[
      'bonus_events:owner_id,target_account_id->accounts:owner_id,id',
      'sop_records:owner_id,template_id->sop_templates:owner_id,id',
      'sop_templates:owner_id,from_account_id->accounts:owner_id,id',
      'sop_templates:owner_id,to_account_id->accounts:owner_id,id'
    ])
  ),
  4::bigint,
  'optional parent links enforce same-owner composite foreign keys'
);

select is(
  (
    select count(*)
    from pg_constraint as constraint_row
    join pg_class as child_relation on child_relation.oid = constraint_row.conrelid
    join pg_namespace as child_namespace on child_namespace.oid = child_relation.relnamespace
    join pg_attribute as nulled_column
      on nulled_column.attrelid = constraint_row.conrelid
      and nulled_column.attnum = constraint_row.confdelsetcols[1]
    where constraint_row.contype = 'f'
      and child_namespace.nspname = 'public'
      and child_relation.relname in ('bonus_events', 'sop_templates', 'sop_records')
      and constraint_row.confdeltype = 'n'
      and cardinality(constraint_row.confdelsetcols) = 1
      and nulled_column.attname in (
        'target_account_id',
        'from_account_id',
        'to_account_id',
        'template_id'
      )
  ),
  4::bigint,
  'optional composite foreign keys null only the parent ID'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.balance_snapshots'::regclass
      and confrelid = 'public.accounts'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ),
  1::bigint,
  'balance snapshots cascade with their account'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.ai_messages'::regclass
      and confrelid = 'public.ai_conversations'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ),
  1::bigint,
  'AI messages cascade with their conversation'
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
    where constraint_row.contype = 'f'
      and child_namespace.nspname = 'public'
      and parent_namespace.nspname = 'auth'
      and parent_relation.relname = 'users'
      and attribute.attname = 'owner_id'
      and constraint_row.confdeltype = 'r'
  ),
  9::bigint,
  'all direct-owner tables restrict deletion of an Auth user with financial data'
);

-- ---------------------------------------------------------------------------
-- Two invited users exercise the public authenticated table interface.
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
    '00000000-0000-4000-8000-00000000000a',
    'authenticated',
    'authenticated',
    'owner-a@example.invalid',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000000b',
    'authenticated',
    'authenticated',
    'owner-b@example.invalid',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.accounts (id, name, bank, purpose)
    values ('10000000-0000-4000-8000-00000000000a', 'Owner A Account', 'A Bank', 'savings')
  $$,
  'owner A can create an account without supplying owner_id'
);

select results_eq(
  $$
    select owner_id
    from public.accounts
    where id = '10000000-0000-4000-8000-00000000000a'
  $$,
  $$ values ('00000000-0000-4000-8000-00000000000a'::uuid) $$,
  'an account defaults to the authenticated owner'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.accounts (id, name, bank, purpose)
    values ('10000000-0000-4000-8000-00000000000b', 'Owner B Account', 'B Bank', 'savings')
  $$,
  'owner B can create an account with the same deployment'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select id from public.accounts order by id $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid) $$,
  'an unfiltered account list returns only owner A data'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is_empty(
  $$
    select id
    from public.accounts
    where id = '10000000-0000-4000-8000-00000000000a'
  $$,
  'owner B cannot read owner A account by ID'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.accounts (id, owner_id, name, bank, purpose)
    values (
      '10000000-0000-4000-8000-0000000000ab',
      '00000000-0000-4000-8000-00000000000b',
      'Spoofed Account',
      'Spoof Bank',
      'savings'
    )
  $$,
  '42501',
  null,
  'owner A cannot create data as owner B'
);

select throws_ok(
  $$
    update public.accounts
    set owner_id = '00000000-0000-4000-8000-00000000000b'
    where id = '10000000-0000-4000-8000-00000000000a'
  $$,
  '42501',
  null,
  'owner A cannot transfer ownership by updating owner_id'
);

select lives_ok(
  $$
    update public.accounts
    set bank = 'A Bank Updated'
    where id = '10000000-0000-4000-8000-00000000000a'
  $$,
  'owner A can update their own account'
);

select results_eq(
  $$
    select bank
    from public.accounts
    where id = '10000000-0000-4000-8000-00000000000a'
  $$,
  $$ values ('A Bank Updated'::text) $$,
  'owner A reads back their account update'
);

select lives_ok(
  $$
    insert into public.accounts (id, name, bank, purpose)
    values ('10000000-0000-4000-8000-00000000001a', 'Disposable A Account', 'A Bank', 'flexible')
  $$,
  'owner A can create a disposable account'
);

select lives_ok(
  $$ delete from public.accounts where id = '10000000-0000-4000-8000-00000000001a' $$,
  'owner A can delete their own disposable account'
);

select is_empty(
  $$ select id from public.accounts where id = '10000000-0000-4000-8000-00000000001a' $$,
  'the deleted owner A account is no longer visible'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is_empty(
  $$
    update public.accounts
    set bank = 'Compromised'
    where id = '10000000-0000-4000-8000-00000000000a'
    returning id
  $$,
  'owner B cannot update owner A account'
);

select is_empty(
  $$
    delete from public.accounts
    where id = '10000000-0000-4000-8000-00000000000a'
    returning id
  $$,
  'owner B cannot delete owner A account'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ update public.accounts set bank = 'A Bulk Update' returning id $$,
  $$ values ('10000000-0000-4000-8000-00000000000a'::uuid) $$,
  'a missing owner filter still updates only the current owner rows'
);

reset role;
select is(
  (
    select bank
    from public.accounts
    where id = '10000000-0000-4000-8000-00000000000b'
  ),
  'B Bank'::text,
  'owner A bulk update leaves owner B unchanged'
);

-- ---------------------------------------------------------------------------
-- Owner-scoped business keys
-- ---------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

insert into public.monthly_milestones (id, year_month)
values ('70000000-0000-4000-8000-00000000000a', '2099-01');

insert into public.sop_templates (
  id,
  step_key,
  step_label,
  due_day,
  from_account_id,
  to_account_id
)
values (
  '20000000-0000-4000-8000-00000000000a',
  'owner_a_parent',
  'Owner A parent template',
  10,
  '10000000-0000-4000-8000-00000000000a',
  '10000000-0000-4000-8000-00000000000a'
);

insert into public.sop_templates (id, step_key, step_label, due_day)
values (
  '20100000-0000-4000-8000-00000000000a',
  'shared_template_key',
  'Shared owner A template',
  11
);

insert into public.sop_records (
  id,
  year_month,
  template_id,
  step_key,
  step_label,
  due_day
)
values (
  '80000000-0000-4000-8000-00000000000a',
  '2099-02',
  '20000000-0000-4000-8000-00000000000a',
  'shared_record_key',
  'Shared owner A monthly step',
  10
);

insert into public.ai_conversations (id, year_month, title, conversation_type)
values (
  '30000000-0000-4000-8000-00000000000a',
  '2099-01',
  'Owner A conversation',
  'general'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

insert into public.sop_templates (id, step_key, step_label, due_day)
values (
  '20000000-0000-4000-8000-00000000000b',
  'owner_b_parent',
  'Owner B parent template',
  10
);

insert into public.ai_conversations (id, year_month, title, conversation_type)
values (
  '30000000-0000-4000-8000-00000000000b',
  '2099-01',
  'Owner B conversation',
  'general'
);

select lives_ok(
  $$
    insert into public.monthly_milestones (id, year_month)
    values ('70000000-0000-4000-8000-00000000000b', '2099-01')
  $$,
  'different owners can use the same milestone month'
);

reset role;
select is(
  (select count(*) from public.monthly_milestones where year_month = '2099-01'),
  2::bigint,
  'the shared milestone month stores one row per owner'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.monthly_milestones (id, year_month)
    values ('70000000-0000-4000-8000-0000000000bb', '2099-01')
  $$,
  '23505',
  null,
  'one owner cannot create a duplicate milestone month'
);

select lives_ok(
  $$
    insert into public.sop_templates (id, step_key, step_label, due_day)
    values (
      '20100000-0000-4000-8000-00000000000b',
      'shared_template_key',
      'Shared owner B template',
      11
    )
  $$,
  'different owners can use the same SOP template key'
);

reset role;
select is(
  (select count(*) from public.sop_templates where step_key = 'shared_template_key'),
  2::bigint,
  'the shared SOP template key stores one row per owner'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.sop_templates (id, step_key, step_label, due_day)
    values (
      '20100000-0000-4000-8000-0000000000bb',
      'shared_template_key',
      'Duplicate owner B template',
      11
    )
  $$,
  '23505',
  null,
  'one owner cannot create a duplicate SOP template key'
);

select lives_ok(
  $$
    insert into public.sop_records (
      id,
      year_month,
      template_id,
      step_key,
      step_label,
      due_day
    )
    values (
      '80000000-0000-4000-8000-00000000000b',
      '2099-02',
      '20000000-0000-4000-8000-00000000000b',
      'shared_record_key',
      'Shared owner B monthly step',
      10
    )
  $$,
  'different owners can use the same monthly SOP step key'
);

reset role;
select is(
  (
    select count(*)
    from public.sop_records
    where year_month = '2099-02'
      and step_key = 'shared_record_key'
  ),
  2::bigint,
  'the shared monthly SOP step key stores one row per owner'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.sop_records (
      id,
      year_month,
      template_id,
      step_key,
      step_label,
      due_day
    )
    values (
      '80000000-0000-4000-8000-0000000000bb',
      '2099-02',
      '20000000-0000-4000-8000-00000000000b',
      'shared_record_key',
      'Duplicate owner B monthly step',
      10
    )
  $$,
  '23505',
  null,
  'one owner cannot create a duplicate monthly SOP step key'
);

-- ---------------------------------------------------------------------------
-- Cross-owner parent IDs are rejected.
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.bonus_events (
      id,
      type,
      label,
      amount,
      expected_date,
      target_account_id
    )
    values (
      '40000000-0000-4000-8000-0000000000ab',
      'other',
      'Cross-owner bonus',
      100,
      '2099-01-15',
      '10000000-0000-4000-8000-00000000000b'
    )
  $$,
  '23503',
  null,
  'owner A bonus cannot target owner B account'
);

select throws_ok(
  $$
    insert into public.sop_templates (
      id,
      step_key,
      step_label,
      due_day,
      from_account_id
    )
    values (
      '20200000-0000-4000-8000-00000000000a',
      'cross_from_account',
      'Cross-owner source',
      12,
      '10000000-0000-4000-8000-00000000000b'
    )
  $$,
  '23503',
  null,
  'owner A SOP template cannot use owner B source account'
);

select throws_ok(
  $$
    insert into public.sop_templates (
      id,
      step_key,
      step_label,
      due_day,
      to_account_id
    )
    values (
      '20200000-0000-4000-8000-00000000001a',
      'cross_to_account',
      'Cross-owner target',
      12,
      '10000000-0000-4000-8000-00000000000b'
    )
  $$,
  '23503',
  null,
  'owner A SOP template cannot use owner B target account'
);

select throws_ok(
  $$
    insert into public.sop_records (
      id,
      year_month,
      template_id,
      step_key,
      step_label,
      due_day
    )
    values (
      '80200000-0000-4000-8000-00000000000a',
      '2099-03',
      '20000000-0000-4000-8000-00000000000b',
      'cross_owner_template',
      'Cross-owner template',
      12
    )
  $$,
  '23503',
  null,
  'owner A monthly SOP step cannot reference owner B template'
);

-- ---------------------------------------------------------------------------
-- Parent-derived balance snapshots enforce old and new parent ownership.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.balance_snapshots (id, account_id, recorded_at, balance)
    values (
      '50000000-0000-4000-8000-00000000000a',
      '10000000-0000-4000-8000-00000000000a',
      '2099-01-01',
      1000
    )
  $$,
  'owner A can create a snapshot for owner A account'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.balance_snapshots (id, account_id, recorded_at, balance)
    values (
      '50000000-0000-4000-8000-00000000000b',
      '10000000-0000-4000-8000-00000000000b',
      '2099-01-03',
      2000
    )
  $$,
  'owner B can create a snapshot for owner B account'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select id from public.balance_snapshots order by id $$,
  $$ values ('50000000-0000-4000-8000-00000000000a'::uuid) $$,
  'owner A unfiltered snapshot list excludes owner B child rows'
);

select throws_ok(
  $$
    insert into public.balance_snapshots (id, account_id, recorded_at, balance)
    values (
      '50000000-0000-4000-8000-0000000000ab',
      '10000000-0000-4000-8000-00000000000b',
      '2099-01-02',
      999
    )
  $$,
  '42501',
  null,
  'owner A cannot insert a snapshot under owner B account'
);

select throws_ok(
  $$
    update public.balance_snapshots
    set account_id = '10000000-0000-4000-8000-00000000000b'
    where id = '50000000-0000-4000-8000-00000000000a'
  $$,
  '42501',
  null,
  'owner A cannot move a visible snapshot to owner B account'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is_empty(
  $$
    update public.balance_snapshots
    set balance = 0
    where id = '50000000-0000-4000-8000-00000000000a'
    returning id
  $$,
  'owner B cannot update owner A snapshot'
);

select is_empty(
  $$
    delete from public.balance_snapshots
    where id = '50000000-0000-4000-8000-00000000000a'
    returning id
  $$,
  'owner B cannot delete owner A snapshot'
);

-- ---------------------------------------------------------------------------
-- Parent-derived AI messages enforce old and new parent ownership.
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.ai_messages (id, conversation_id, role, content)
    values (
      '60000000-0000-4000-8000-00000000000a',
      '30000000-0000-4000-8000-00000000000a',
      'user',
      'Owner A message'
    )
  $$,
  'owner A can create a message in owner A conversation'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.ai_messages (id, conversation_id, role, content)
    values (
      '60000000-0000-4000-8000-00000000000b',
      '30000000-0000-4000-8000-00000000000b',
      'user',
      'Owner B message'
    )
  $$,
  'owner B can create a message in owner B conversation'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select id from public.ai_messages order by id $$,
  $$ values ('60000000-0000-4000-8000-00000000000a'::uuid) $$,
  'owner A unfiltered message list excludes owner B child rows'
);

select throws_ok(
  $$
    insert into public.ai_messages (id, conversation_id, role, content)
    values (
      '60000000-0000-4000-8000-0000000000ab',
      '30000000-0000-4000-8000-00000000000b',
      'user',
      'Cross-owner message'
    )
  $$,
  '42501',
  null,
  'owner A cannot insert a message under owner B conversation'
);

select throws_ok(
  $$
    update public.ai_messages
    set conversation_id = '30000000-0000-4000-8000-00000000000b'
    where id = '60000000-0000-4000-8000-00000000000a'
  $$,
  '42501',
  null,
  'owner A cannot move a visible message to owner B conversation'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000b';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}';

select is_empty(
  $$
    update public.ai_messages
    set content = 'Compromised'
    where id = '60000000-0000-4000-8000-00000000000a'
    returning id
  $$,
  'owner B cannot update owner A message'
);

select is_empty(
  $$
    delete from public.ai_messages
    where id = '60000000-0000-4000-8000-00000000000a'
    returning id
  $$,
  'owner B cannot delete owner A message'
);

-- ---------------------------------------------------------------------------
-- Parent deletion is scoped and preserves the intended child behavior.
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

insert into public.bonus_events (
  id,
  type,
  label,
  amount,
  expected_date,
  target_account_id
)
values (
  '40000000-0000-4000-8000-00000000000a',
  'other',
  'Owner A bonus',
  100,
  '2099-01-15',
  '10000000-0000-4000-8000-00000000000a'
);

select lives_ok(
  $$ delete from public.accounts where id = '10000000-0000-4000-8000-00000000000a' $$,
  'owner A can delete their own account with linked rows'
);

reset role;
select is(
  (
    select count(*)
    from public.balance_snapshots
    where id = '50000000-0000-4000-8000-00000000000a'
  ),
  0::bigint,
  'deleting owner A account cascades owner A balance snapshot'
);

select ok(
  (
    select target_account_id is null
      and owner_id = '00000000-0000-4000-8000-00000000000a'
    from public.bonus_events
    where id = '40000000-0000-4000-8000-00000000000a'
  ),
  'deleting an account nulls only the bonus parent ID and preserves owner A'
);

select ok(
  (
    select from_account_id is null
      and to_account_id is null
      and owner_id = '00000000-0000-4000-8000-00000000000a'
    from public.sop_templates
    where id = '20000000-0000-4000-8000-00000000000a'
  ),
  'deleting an account nulls only SOP account IDs and preserves owner A'
);

select is(
  (
    select count(*)
    from public.accounts as account
    join public.balance_snapshots as snapshot on snapshot.account_id = account.id
    where account.id = '10000000-0000-4000-8000-00000000000b'
      and snapshot.id = '50000000-0000-4000-8000-00000000000b'
  ),
  1::bigint,
  'deleting owner A account leaves owner B account and snapshot unchanged'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ delete from public.sop_templates where id = '20000000-0000-4000-8000-00000000000a' $$,
  'owner A can delete their own SOP template with linked monthly records'
);

reset role;
select ok(
  (
    select template_id is null
      and owner_id = '00000000-0000-4000-8000-00000000000a'
    from public.sop_records
    where id = '80000000-0000-4000-8000-00000000000a'
  ),
  'deleting an SOP template nulls only template_id and preserves owner A'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-00000000000a';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ delete from public.ai_conversations where id = '30000000-0000-4000-8000-00000000000a' $$,
  'owner A can delete their own AI conversation'
);

reset role;
select is(
  (
    select count(*)
    from public.ai_messages
    where id = '60000000-0000-4000-8000-00000000000a'
  ),
  0::bigint,
  'deleting owner A conversation cascades owner A message'
);

select is(
  (
    select count(*)
    from public.ai_conversations as conversation
    join public.ai_messages as message on message.conversation_id = conversation.id
    where conversation.id = '30000000-0000-4000-8000-00000000000b'
      and message.id = '60000000-0000-4000-8000-00000000000b'
  ),
  1::bigint,
  'deleting owner A conversation leaves owner B conversation and message unchanged'
);

-- ---------------------------------------------------------------------------
-- Anonymous access, null owners, Auth-user deletion, and privileged roles.
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select * from public.accounts $$,
  '42501',
  null,
  'anonymous clients cannot select business rows'
);

select throws_ok(
  $$
    insert into public.accounts (id, name, bank, purpose)
    values ('10000000-0000-4000-8000-0000000000ff', 'Anon Account', 'Anon Bank', 'savings')
  $$,
  '42501',
  null,
  'anonymous clients cannot insert business rows'
);

reset role;

select throws_ok(
  $$ delete from auth.users where id = '00000000-0000-4000-8000-00000000000a' $$,
  '23503',
  null,
  'an Auth user with financial data cannot be deleted implicitly'
);

select is(
  (
    select count(*)
    from public.monthly_milestones
    where owner_id = '00000000-0000-4000-8000-00000000000a'
  ),
  1::bigint,
  'failed Auth-user deletion preserves owner A financial data'
);

select throws_ok(
  $$
    insert into public.impulse_logs (
      id,
      owner_id,
      item_name,
      estimated_price
    )
    values (
      '90000000-0000-4000-8000-00000000000a',
      null,
      'Null owner probe',
      1
    )
  $$,
  '23502',
  null,
  'database constraints reject an explicit null owner'
);

select is(
  (
    select
      (select count(*) from public.accounts where owner_id is null)
      + (select count(*) from public.salary_configs where owner_id is null)
      + (select count(*) from public.bonus_events where owner_id is null)
      + (select count(*) from public.monthly_milestones where owner_id is null)
      + (select count(*) from public.sop_templates where owner_id is null)
      + (select count(*) from public.sop_records where owner_id is null)
      + (select count(*) from public.ai_conversations where owner_id is null)
      + (select count(*) from public.ai_configs where owner_id is null)
      + (select count(*) from public.impulse_logs where owner_id is null)
  ),
  0::bigint,
  'no direct-owner row has null ownership after hostile inputs'
);

select is(
  (select rolbypassrls from pg_roles where rolname = 'authenticated'),
  false,
  'authenticated role cannot bypass row-level security'
);

select is(
  (select rolbypassrls from pg_roles where rolname = 'anon'),
  false,
  'anonymous role cannot bypass row-level security'
);

select is(
  (select rolbypassrls from pg_roles where rolname = 'service_role'),
  true,
  'service_role bypass is explicit and must remain outside the application runtime'
);

select * from finish();
rollback;
