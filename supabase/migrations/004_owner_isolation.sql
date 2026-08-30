begin;

-- Freeze identities and business writes so the preflight result remains true
-- through backfill and policy cutover.
lock table auth.users in share mode;
lock table
  public.accounts,
  public.salary_configs,
  public.bonus_events,
  public.monthly_milestones,
  public.balance_snapshots,
  public.sop_templates,
  public.sop_records,
  public.ai_conversations,
  public.ai_messages,
  public.ai_configs,
  public.impulse_logs
in share row exclusive mode;

-- Existing business data has one valid interpretation only when exactly one
-- Auth user exists. Empty installs need no legacy mapping and may have any
-- number of pre-created users.
do $owner_preflight$
declare
  business_rows bigint;
  auth_user_count bigint;
begin
  select
    (select count(*) from public.accounts)
    + (select count(*) from public.salary_configs)
    + (select count(*) from public.bonus_events)
    + (select count(*) from public.monthly_milestones)
    + (select count(*) from public.balance_snapshots)
    + (select count(*) from public.sop_templates)
    + (select count(*) from public.sop_records)
    + (select count(*) from public.ai_conversations)
    + (select count(*) from public.ai_messages)
    + (select count(*) from public.ai_configs)
    + (select count(*) from public.impulse_logs)
  into business_rows;

  select count(*) into auth_user_count from auth.users;

  if business_rows > 0 and auth_user_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'owner isolation preflight failed',
      detail = format(
        'Existing business rows require exactly one Auth user; found %s Auth users.',
        auth_user_count
      ),
      hint = 'Resolve the legacy owner mapping before rerunning this migration.';
  end if;
end;
$owner_preflight$;

create temporary table owner_isolation_counts (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

insert into owner_isolation_counts (table_name, row_count)
values
  ('accounts', (select count(*) from public.accounts)),
  ('salary_configs', (select count(*) from public.salary_configs)),
  ('bonus_events', (select count(*) from public.bonus_events)),
  ('monthly_milestones', (select count(*) from public.monthly_milestones)),
  ('balance_snapshots', (select count(*) from public.balance_snapshots)),
  ('sop_templates', (select count(*) from public.sop_templates)),
  ('sop_records', (select count(*) from public.sop_records)),
  ('ai_conversations', (select count(*) from public.ai_conversations)),
  ('ai_messages', (select count(*) from public.ai_messages)),
  ('ai_configs', (select count(*) from public.ai_configs)),
  ('impulse_logs', (select count(*) from public.impulse_logs));

alter table public.accounts add column owner_id uuid;
alter table public.salary_configs add column owner_id uuid;
alter table public.bonus_events add column owner_id uuid;
alter table public.monthly_milestones add column owner_id uuid;
alter table public.sop_templates add column owner_id uuid;
alter table public.sop_records add column owner_id uuid;
alter table public.ai_conversations add column owner_id uuid;
alter table public.ai_configs add column owner_id uuid;
alter table public.impulse_logs add column owner_id uuid;

do $owner_backfill$
declare
  business_rows bigint;
  legacy_owner uuid;
begin
  select sum(row_count) into business_rows from owner_isolation_counts;

  if business_rows > 0 then
    select id into strict legacy_owner from auth.users;

    update public.accounts set owner_id = legacy_owner where owner_id is null;
    update public.salary_configs set owner_id = legacy_owner where owner_id is null;
    update public.bonus_events set owner_id = legacy_owner where owner_id is null;
    update public.monthly_milestones set owner_id = legacy_owner where owner_id is null;
    update public.sop_templates set owner_id = legacy_owner where owner_id is null;
    update public.sop_records set owner_id = legacy_owner where owner_id is null;
    update public.ai_conversations set owner_id = legacy_owner where owner_id is null;
    update public.ai_configs set owner_id = legacy_owner where owner_id is null;
    update public.impulse_logs set owner_id = legacy_owner where owner_id is null;
  end if;
end;
$owner_backfill$;

alter table public.accounts
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint accounts_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.salary_configs
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint salary_configs_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.bonus_events
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint bonus_events_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.monthly_milestones
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint monthly_milestones_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.sop_templates
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint sop_templates_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.sop_records
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint sop_records_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.ai_conversations
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint ai_conversations_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.ai_configs
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint ai_configs_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.impulse_logs
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null,
  add constraint impulse_logs_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict;

-- Composite parent keys let PostgreSQL reject cross-owner references.
alter table public.accounts
  add constraint accounts_owner_id_id_key unique (owner_id, id);

alter table public.sop_templates
  add constraint sop_templates_owner_id_id_key unique (owner_id, id);

-- Replace global uniqueness with owner-scoped uniqueness.
alter table public.monthly_milestones
  drop constraint monthly_milestones_year_month_key,
  add constraint monthly_milestones_owner_id_year_month_key
    unique (owner_id, year_month);

alter table public.sop_templates
  drop constraint sop_templates_step_key_key,
  add constraint sop_templates_owner_id_step_key_key
    unique (owner_id, step_key);

alter table public.sop_records
  drop constraint sop_records_year_month_step_key_key,
  add constraint sop_records_owner_id_year_month_step_key_key
    unique (owner_id, year_month, step_key);

-- PostgreSQL 17 column-list SET NULL preserves owner_id while retaining the
-- existing optional-link deletion behavior.
alter table public.bonus_events
  drop constraint bonus_events_target_account_id_fkey,
  add constraint bonus_events_owner_target_account_fkey
    foreign key (owner_id, target_account_id)
    references public.accounts(owner_id, id)
    on delete set null (target_account_id);

alter table public.sop_templates
  drop constraint sop_templates_from_account_id_fkey,
  drop constraint sop_templates_to_account_id_fkey,
  add constraint sop_templates_owner_from_account_fkey
    foreign key (owner_id, from_account_id)
    references public.accounts(owner_id, id)
    on delete set null (from_account_id),
  add constraint sop_templates_owner_to_account_fkey
    foreign key (owner_id, to_account_id)
    references public.accounts(owner_id, id)
    on delete set null (to_account_id);

alter table public.sop_records
  drop constraint sop_records_template_id_fkey,
  add constraint sop_records_owner_template_fkey
    foreign key (owner_id, template_id)
    references public.sop_templates(owner_id, id)
    on delete set null (template_id);

create index idx_salary_configs_owner_effective
  on public.salary_configs(owner_id, effective_from desc);
create index idx_bonus_events_owner_target
  on public.bonus_events(owner_id, target_account_id);
create index idx_bonus_events_owner_expected_date
  on public.bonus_events(owner_id, expected_date);
create index idx_sop_templates_owner_from_account
  on public.sop_templates(owner_id, from_account_id);
create index idx_sop_templates_owner_to_account
  on public.sop_templates(owner_id, to_account_id);
create index idx_sop_records_owner_template
  on public.sop_records(owner_id, template_id);
create index idx_sop_records_owner_month_milestone
  on public.sop_records(owner_id, year_month, counts_toward_milestone);
create index idx_ai_conversations_owner_updated
  on public.ai_conversations(owner_id, updated_at desc);
create index idx_ai_configs_owner_created
  on public.ai_configs(owner_id, created_at);
create index idx_impulse_logs_owner_created
  on public.impulse_logs(owner_id, created_at desc);

-- Policies are permissive and combine with OR. Remove the legacy broad policy
-- in the same transaction as the owner-scoped policy creation.
drop policy if exists "Authenticated access" on public.accounts;
drop policy if exists "Authenticated access" on public.salary_configs;
drop policy if exists "Authenticated access" on public.bonus_events;
drop policy if exists "Authenticated access" on public.monthly_milestones;
drop policy if exists "Authenticated access" on public.balance_snapshots;
drop policy if exists "Authenticated access" on public.sop_templates;
drop policy if exists "Authenticated access" on public.sop_records;
drop policy if exists "Authenticated access" on public.ai_conversations;
drop policy if exists "Authenticated access" on public.ai_messages;
drop policy if exists "Authenticated access" on public.ai_configs;
drop policy if exists "Authenticated access" on public.impulse_logs;

revoke all privileges on table
  public.accounts,
  public.salary_configs,
  public.bonus_events,
  public.monthly_milestones,
  public.balance_snapshots,
  public.sop_templates,
  public.sop_records,
  public.ai_conversations,
  public.ai_messages,
  public.ai_configs,
  public.impulse_logs
from anon, authenticated;

grant select, insert, update, delete on table
  public.accounts,
  public.salary_configs,
  public.bonus_events,
  public.monthly_milestones,
  public.balance_snapshots,
  public.sop_templates,
  public.sop_records,
  public.ai_conversations,
  public.ai_messages,
  public.impulse_logs
to authenticated;

do $direct_owner_policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts',
    'salary_configs',
    'bonus_events',
    'monthly_milestones',
    'sop_templates',
    'sop_records',
    'ai_conversations',
    'ai_configs',
    'impulse_logs'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_owner_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)',
      table_name || '_owner_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      table_name || '_owner_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)',
      table_name || '_owner_delete',
      table_name
    );
  end loop;
end;
$direct_owner_policies$;

create policy balance_snapshots_owner_select
on public.balance_snapshots for select to authenticated
using (
  exists (
    select 1
    from public.accounts as account
    where account.id = balance_snapshots.account_id
      and account.owner_id = (select auth.uid())
  )
);

create policy balance_snapshots_owner_insert
on public.balance_snapshots for insert to authenticated
with check (
  exists (
    select 1
    from public.accounts as account
    where account.id = balance_snapshots.account_id
      and account.owner_id = (select auth.uid())
  )
);

create policy balance_snapshots_owner_update
on public.balance_snapshots for update to authenticated
using (
  exists (
    select 1
    from public.accounts as account
    where account.id = balance_snapshots.account_id
      and account.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.accounts as account
    where account.id = balance_snapshots.account_id
      and account.owner_id = (select auth.uid())
  )
);

create policy balance_snapshots_owner_delete
on public.balance_snapshots for delete to authenticated
using (
  exists (
    select 1
    from public.accounts as account
    where account.id = balance_snapshots.account_id
      and account.owner_id = (select auth.uid())
  )
);

create policy ai_messages_owner_select
on public.ai_messages for select to authenticated
using (
  exists (
    select 1
    from public.ai_conversations as conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
);

create policy ai_messages_owner_insert
on public.ai_messages for insert to authenticated
with check (
  exists (
    select 1
    from public.ai_conversations as conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
);

create policy ai_messages_owner_update
on public.ai_messages for update to authenticated
using (
  exists (
    select 1
    from public.ai_conversations as conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.ai_conversations as conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
);

create policy ai_messages_owner_delete
on public.ai_messages for delete to authenticated
using (
  exists (
    select 1
    from public.ai_conversations as conversation
    where conversation.id = ai_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
);

do $owner_readback$
declare
  expected record;
  actual_count bigint;
  policy_count bigint;
  rls_table_count bigint;
  owner_fk_count bigint;
  constraint_row record;
begin
  for expected in select table_name, row_count from owner_isolation_counts
  loop
    execute format('select count(*) from public.%I', expected.table_name)
      into actual_count;
    if actual_count <> expected.row_count then
      raise exception 'owner isolation row-count mismatch for %: expected %, got %',
        expected.table_name,
        expected.row_count,
        actual_count;
    end if;
    raise notice 'owner isolation readback: % rows=%', expected.table_name, actual_count;
  end loop;

  if exists (select 1 from public.accounts where owner_id is null)
    or exists (select 1 from public.salary_configs where owner_id is null)
    or exists (select 1 from public.bonus_events where owner_id is null)
    or exists (select 1 from public.monthly_milestones where owner_id is null)
    or exists (select 1 from public.sop_templates where owner_id is null)
    or exists (select 1 from public.sop_records where owner_id is null)
    or exists (select 1 from public.ai_conversations where owner_id is null)
    or exists (select 1 from public.ai_configs where owner_id is null)
    or exists (select 1 from public.impulse_logs where owner_id is null)
  then
    raise exception 'owner isolation readback failed: null owner_id remains';
  end if;

  if exists (
    select 1
    from public.balance_snapshots as snapshot
    left join public.accounts as account on account.id = snapshot.account_id
    where account.id is null
  ) or exists (
    select 1
    from public.ai_messages as message
    left join public.ai_conversations as conversation
      on conversation.id = message.conversation_id
    where conversation.id is null
  ) then
    raise exception 'owner isolation readback failed: parent-derived orphan remains';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and policyname = 'Authenticated access'
  ) then
    raise exception 'owner isolation policy cutover failed: broad policy remains';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = any (array[
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
    and policyname in (
      tablename || '_owner_select',
      tablename || '_owner_insert',
      tablename || '_owner_update',
      tablename || '_owner_delete'
    );

  if policy_count <> 44 then
    raise exception 'owner isolation policy readback failed: expected 44, got %', policy_count;
  end if;

  select count(*) into rls_table_count
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
    and relation.relrowsecurity;

  if rls_table_count <> 11 then
    raise exception 'owner isolation RLS readback failed: expected 11, got %', rls_table_count;
  end if;

  select count(*) into owner_fk_count
  from pg_constraint
  where conname = any (array[
      'accounts_owner_id_fkey',
      'salary_configs_owner_id_fkey',
      'bonus_events_owner_id_fkey',
      'monthly_milestones_owner_id_fkey',
      'sop_templates_owner_id_fkey',
      'sop_records_owner_id_fkey',
      'ai_conversations_owner_id_fkey',
      'ai_configs_owner_id_fkey',
      'impulse_logs_owner_id_fkey'
    ])
    and contype = 'f'
    and confdeltype = 'r';

  if owner_fk_count <> 9 then
    raise exception 'owner isolation owner FK readback failed: expected 9 RESTRICT constraints, got %',
      owner_fk_count;
  end if;

  for constraint_row in
    select *
    from (values
      ('bonus_events_owner_target_account_fkey', 'target_account_id'),
      ('sop_templates_owner_from_account_fkey', 'from_account_id'),
      ('sop_templates_owner_to_account_fkey', 'to_account_id'),
      ('sop_records_owner_template_fkey', 'template_id')
    ) as expected_constraint(constraint_name, nullable_column)
  loop
    if not exists (
      select 1
      from pg_constraint
      where conname = constraint_row.constraint_name
        and contype = 'f'
        and confdeltype = 'n'
        and cardinality(confdelsetcols) = 1
        and pg_get_constraintdef(oid) like
          '%ON DELETE SET NULL (' || constraint_row.nullable_column || ')%'
    ) then
      raise exception 'owner isolation optional FK readback failed: %',
        constraint_row.constraint_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'balance_snapshots_account_id_fkey'
      and confdeltype = 'c'
  ) or not exists (
    select 1 from pg_constraint
    where conname = 'ai_messages_conversation_id_fkey'
      and confdeltype = 'c'
  ) then
    raise exception 'owner isolation cascade readback failed';
  end if;

  if exists (
    select 1
    from unnest(array[
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
    ]) as target(table_name)
    where has_table_privilege('anon', format('public.%I', target.table_name), 'select')
      or has_table_privilege('anon', format('public.%I', target.table_name), 'insert')
      or has_table_privilege('anon', format('public.%I', target.table_name), 'update')
      or has_table_privilege('anon', format('public.%I', target.table_name), 'delete')
  ) then
    raise exception 'owner isolation grant readback failed: anon retains business-table privileges';
  end if;

  if has_table_privilege('authenticated', 'public.ai_configs', 'select')
    or has_table_privilege('authenticated', 'public.ai_configs', 'insert')
    or has_table_privilege('authenticated', 'public.ai_configs', 'update')
    or has_table_privilege('authenticated', 'public.ai_configs', 'delete')
  then
    raise exception 'owner isolation grant readback failed: Consumer BYOK remains accessible';
  end if;

  raise notice 'owner isolation readback: null owners=0, child orphans=0, policies=44, RLS tables=11';
end;
$owner_readback$;

commit;
