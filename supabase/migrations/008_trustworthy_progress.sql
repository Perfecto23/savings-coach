begin;

alter table public.balance_snapshots
  drop constraint balance_snapshots_account_id_fkey,
  alter column balance type numeric using balance::numeric,
  add constraint balance_snapshots_balance_check
    check (
      balance::text not in ('NaN', 'Infinity', '-Infinity')
      and balance >= 0
      and balance <= 9999999999.99
      and scale(balance) <= 2
    ),
  add constraint balance_snapshots_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict;

create or replace function public.protect_setup_linked_account_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.owner_setup as setup
    where setup.owner_id = old.owner_id
      and setup.savings_account_id = old.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'setup_linked_account_delete_forbidden';
  end if;

  return old;
end;
$function$;

create trigger accounts_block_setup_linked_delete
before delete on public.accounts
for each row execute function public.protect_setup_linked_account_delete();

drop policy if exists balance_snapshots_owner_insert on public.balance_snapshots;
drop policy if exists balance_snapshots_owner_update on public.balance_snapshots;
drop policy if exists balance_snapshots_owner_delete on public.balance_snapshots;

create policy balance_snapshots_owner_insert
on public.balance_snapshots for insert to authenticated
with check (false);

create policy balance_snapshots_owner_update
on public.balance_snapshots for update to authenticated
using (false)
with check (false);

create policy balance_snapshots_owner_delete
on public.balance_snapshots for delete to authenticated
using (false);

drop policy if exists monthly_milestones_owner_insert on public.monthly_milestones;
drop policy if exists monthly_milestones_owner_update on public.monthly_milestones;
drop policy if exists monthly_milestones_owner_delete on public.monthly_milestones;

create policy monthly_milestones_owner_insert
on public.monthly_milestones for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and not is_plan_path
);

create policy monthly_milestones_owner_update
on public.monthly_milestones for update to authenticated
using (
  (select auth.uid()) = owner_id
  and not is_plan_path
)
with check (
  (select auth.uid()) = owner_id
  and not is_plan_path
);

create policy monthly_milestones_owner_delete
on public.monthly_milestones for delete to authenticated
using (
  (select auth.uid()) = owner_id
  and not is_plan_path
);

create or replace function public.protect_plan_path_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.is_plan_path then
    raise exception using
      errcode = 'P0001',
      message = 'plan_path_delete_forbidden';
  end if;

  return old;
end;
$function$;

create trigger monthly_milestones_block_plan_path_delete
before delete on public.monthly_milestones
for each row execute function public.protect_plan_path_delete();

alter function public.save_owner_setup_step(text, jsonb)
  rename to save_owner_setup_step_unchecked;
alter function public.save_owner_setup_step_unchecked(text, jsonb)
  security definer;
revoke all on function public.save_owner_setup_step_unchecked(text, jsonb)
  from public, anon, authenticated;

create function public.save_owner_setup_step(
  p_step text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  setup_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  requested_balance numeric;
  requested_date date;
  observation_count integer;
  exact_retry boolean;
begin
  if setup_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(setup_owner::text, 0)
  );

  if p_step <> 'initial_balance' then
    return public.save_owner_setup_step_unchecked(p_step, p_payload);
  end if;

  select * into setup_row
  from public.owner_setup
  where owner_id = setup_owner
  for update;
  if not found or setup_row.savings_account_id is null then
    return public.save_owner_setup_step_unchecked(p_step, p_payload);
  end if;
  if setup_row.plan_activated_at is not null then
    raise exception using errcode = 'P0001', message = 'initial_balance_locked';
  end if;

  begin
    requested_balance := (p_payload ->> 'balance')::numeric;
    requested_date := (p_payload ->> 'recorded_at')::date;
  exception when others then
    return public.save_owner_setup_step_unchecked(p_step, p_payload);
  end;

  select
    count(*),
    coalesce(
      bool_or(
        snapshot.recorded_at = requested_date
        and snapshot.balance = requested_balance
      ),
      false
    )
  into observation_count, exact_retry
  from public.balance_snapshots as snapshot
  where snapshot.account_id = setup_row.savings_account_id;

  if observation_count = 0 or (observation_count = 1 and exact_retry) then
    return public.save_owner_setup_step_unchecked(p_step, p_payload);
  end if;

  raise exception using errcode = 'P0001', message = 'initial_balance_locked';
end;
$function$;

revoke all on function public.save_owner_setup_step(text, jsonb)
  from public, anon;
grant execute on function public.save_owner_setup_step(text, jsonb)
  to authenticated;

create or replace function public.refresh_balance_observations(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.monthly_milestones
  set
    actual_savings = null,
    actual_total_savings = null
  where owner_id = p_owner
    and (
      actual_savings is not null
      or actual_total_savings is not null
    );

  with observed_months as (
    select distinct date_trunc('month', snapshot.recorded_at)::date as month_start
    from public.balance_snapshots as snapshot
    join public.accounts as account on account.id = snapshot.account_id
    where account.owner_id = p_owner
      and account.purpose = 'savings'
  ),
  monthly_totals as (
    select
      observed.month_start,
      total.amount::numeric(12,2) as amount
    from observed_months as observed
    cross join lateral (
      select sum(latest.balance) as amount
      from public.accounts as account
      cross join lateral (
        select snapshot.balance
        from public.balance_snapshots as snapshot
        where snapshot.account_id = account.id
          and snapshot.recorded_at <= (
            observed.month_start + interval '1 month - 1 day'
          )::date
        order by snapshot.recorded_at desc, snapshot.created_at desc
        limit 1
      ) as latest
      where account.owner_id = p_owner
        and account.purpose = 'savings'
    ) as total
  ),
  observed_deltas as (
    select
      month_start,
      amount,
      amount - lag(amount) over (order by month_start) as amount_change
    from monthly_totals
  )
  update public.monthly_milestones as milestone
  set
    actual_savings = observed.amount_change,
    actual_total_savings = observed.amount
  from observed_deltas as observed
  where milestone.owner_id = p_owner
    and milestone.year_month = to_char(observed.month_start, 'YYYY-MM');
end;
$function$;

revoke all on function public.refresh_balance_observations(uuid)
  from public, anon, authenticated;

create or replace function public.rebuild_savings_plan_path(p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  setup_row public.owner_setup%rowtype;
  local_today date;
  current_month date;
  current_year_month text;
  baseline numeric(12,2);
  path_payload jsonb;
begin
  select * into setup_row
  from public.owner_setup
  where owner_id = p_owner;
  if not found or setup_row.savings_account_id is null then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  local_today := (current_timestamp at time zone setup_row.time_zone)::date;
  current_month := date_trunc('month', local_today)::date;
  current_year_month := to_char(current_month, 'YYYY-MM');

  select path.planned_total_savings - path.planned_savings
  into baseline
  from public.monthly_milestones as path
  where path.owner_id = p_owner
    and path.is_plan_path
    and path.year_month = current_year_month;

  if baseline is null then
    select sum(latest.balance)::numeric(12,2)
    into baseline
    from public.accounts as account
    cross join lateral (
      select snapshot.balance
      from public.balance_snapshots as snapshot
      where snapshot.account_id = account.id
        and snapshot.recorded_at <= local_today
      order by snapshot.recorded_at desc, snapshot.created_at desc
      limit 1
    ) as latest
    where account.owner_id = p_owner
      and account.purpose = 'savings';
  end if;

  if baseline is null then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  with months as (
    select (current_month + (offset_value || ' months')::interval)::date as month_start
    from generate_series(0, 11) as offset_value
  ),
  action_totals as (
    select
      to_date(action.year_month || '-01', 'YYYY-MM-DD') as month_start,
      count(*) as action_count,
      coalesce(
        sum(coalesce(action.milestone_amount, action.amount)),
        0
      )::numeric(12,2) as amount,
      bool_and(action.completed) as all_completed
    from public.sop_records as action
    where action.owner_id = p_owner
      and action.is_monthly_action
      and to_date(action.year_month || '-01', 'YYYY-MM-DD') between current_month
        and (current_month + interval '11 months')::date
    group by action.year_month
  ),
  active_rule_total as (
    select coalesce(sum(rule.default_amount), 0)::numeric(12,2) as amount
    from public.sop_templates as rule
    where rule.owner_id = p_owner
      and rule.is_plan_rule
      and rule.is_active
      and rule.default_amount > 0
      and rule.to_account_id = setup_row.savings_account_id
  ),
  bonus_totals as (
    select
      date_trunc('month', bonus.expected_date)::date as month_start,
      coalesce(
        sum(coalesce(bonus.actual_amount, bonus.amount)),
        0
      )::numeric(12,2) as amount
    from public.bonus_events as bonus
    where bonus.owner_id = p_owner
      and bonus.target_account_id = setup_row.savings_account_id
      and bonus.expected_date between current_month
        and (current_month + interval '1 year - 1 day')::date
    group by date_trunc('month', bonus.expected_date)::date
  ),
  planned as (
    select
      month.month_start,
      (
        case
          when coalesce(action.action_count, 0) > 0 then action.amount
          else rule.amount
        end
        + coalesce(bonus.amount, 0)
      )::numeric(12,2) as planned_savings,
      case
        when month.month_start = current_month
          and coalesce(action.action_count, 0) > 0
          and action.all_completed
        then 'on_track'
        else 'pending'
      end as status
    from months as month
    cross join active_rule_total as rule
    left join action_totals as action on action.month_start = month.month_start
    left join bonus_totals as bonus on bonus.month_start = month.month_start
  ),
  path as (
    select
      month_start,
      planned_savings,
      (
        baseline
        + sum(planned_savings) over (
          order by month_start rows unbounded preceding
        )
      )::numeric(12,2) as planned_total_savings,
      status
    from planned
  ),
  upserted as (
    insert into public.monthly_milestones (
      owner_id,
      year_month,
      planned_savings,
      planned_total_savings,
      status,
      is_plan_path
    )
    select
      p_owner,
      to_char(month_start, 'YYYY-MM'),
      planned_savings,
      planned_total_savings,
      status,
      true
    from path
    on conflict (owner_id, year_month) do update
    set
      planned_savings = excluded.planned_savings,
      planned_total_savings = excluded.planned_total_savings,
      status = excluded.status,
      is_plan_path = true
    returning year_month, planned_savings, planned_total_savings
  )
  select jsonb_agg(
    jsonb_build_object(
      'year_month', year_month,
      'planned_savings', planned_savings,
      'planned_total_savings', planned_total_savings
    ) order by year_month
  ) into path_payload
  from upserted;

  if jsonb_array_length(coalesce(path_payload, '[]'::jsonb)) <> 12 then
    raise exception using errcode = 'P0001', message = 'plan_path_incomplete';
  end if;

  perform public.refresh_balance_observations(p_owner);
  return path_payload;
end;
$function$;

revoke all on function public.rebuild_savings_plan_path(uuid)
  from public, anon, authenticated;

create or replace function public.save_balance_observations(
  p_recorded_at date,
  p_balances jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  observation_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  observation jsonb;
  observation_account_id uuid;
  observation_balance numeric;
  observation_note text;
  observed_account_ids uuid[] := array[]::uuid[];
  saved_count integer := 0;
  current_year_month text;
  has_current_path boolean;
begin
  if observation_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(observation_owner::text, 0)
  );

  select * into setup_row
  from public.owner_setup
  where owner_id = observation_owner
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  if p_recorded_at is null
    or p_recorded_at > (
      current_timestamp at time zone setup_row.time_zone
    )::date
  then
    raise exception using errcode = 'P0001', message = 'invalid_observation_date';
  end if;
  if p_balances is null
    or jsonb_typeof(p_balances) <> 'array'
    or jsonb_array_length(p_balances) = 0
    or jsonb_array_length(p_balances) > 100
  then
    raise exception using errcode = 'P0001', message = 'invalid_observations';
  end if;

  for observation in
    select value from jsonb_array_elements(p_balances)
  loop
    if jsonb_typeof(observation) <> 'object'
      or exists (
        select 1
        from jsonb_object_keys(observation) as observation_keys(key)
        where observation_keys.key not in ('account_id', 'balance', 'note')
      )
    then
      raise exception using errcode = 'P0001', message = 'invalid_observation';
    end if;

    begin
      observation_account_id := (observation ->> 'account_id')::uuid;
      observation_balance := (observation ->> 'balance')::numeric;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_observation';
    end;

    if observation_account_id = any(observed_account_ids) then
      raise exception using errcode = 'P0001', message = 'duplicate_observation_account';
    end if;
    observed_account_ids := array_append(
      observed_account_ids,
      observation_account_id
    );

    if observation_balance is null
      or observation_balance::text in ('NaN', 'Infinity', '-Infinity')
      or observation_balance < 0
      or observation_balance > 9999999999.99
      or scale(observation_balance) > 2
    then
      raise exception using errcode = 'P0001', message = 'invalid_observation_balance';
    end if;

    if observation ? 'note' and observation -> 'note' <> 'null'::jsonb then
      if jsonb_typeof(observation -> 'note') <> 'string' then
        raise exception using errcode = 'P0001', message = 'invalid_observation_note';
      end if;
      observation_note := observation ->> 'note';
      if char_length(observation_note) > 1000 then
        raise exception using errcode = 'P0001', message = 'invalid_observation_note';
      end if;
    else
      observation_note := null;
    end if;

    if not exists (
      select 1
      from public.accounts as account
      where account.owner_id = observation_owner
        and account.id = observation_account_id
    ) then
      raise exception using errcode = 'P0001', message = 'account_not_found';
    end if;

    insert into public.balance_snapshots (
      account_id,
      recorded_at,
      balance,
      note
    ) values (
      observation_account_id,
      p_recorded_at,
      observation_balance,
      observation_note
    )
    on conflict (account_id, recorded_at) do update
    set
      balance = excluded.balance,
      note = excluded.note;
    saved_count := saved_count + 1;
  end loop;

  current_year_month := to_char(
    date_trunc('month', current_timestamp at time zone setup_row.time_zone),
    'YYYY-MM'
  );
  select exists (
    select 1
    from public.monthly_milestones
    where owner_id = observation_owner
      and is_plan_path
      and year_month = current_year_month
  ) into has_current_path;

  if setup_row.plan_activated_at is not null then
    if not has_current_path then
      raise exception using errcode = 'P0001', message = 'plan_path_incomplete';
    end if;
    perform public.rebuild_savings_plan_path(observation_owner);
  else
    perform public.refresh_balance_observations(observation_owner);
  end if;

  return jsonb_build_object(
    'recorded_at', p_recorded_at,
    'saved_count', saved_count
  );
end;
$function$;

create or replace function public.delete_balance_observations(
  p_recorded_at date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  observation_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  deleted_count integer;
  current_year_month text;
  has_current_path boolean;
begin
  if observation_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(observation_owner::text, 0)
  );

  select * into setup_row
  from public.owner_setup
  where owner_id = observation_owner
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  if p_recorded_at is null
    or p_recorded_at > (
      current_timestamp at time zone setup_row.time_zone
    )::date
  then
    raise exception using errcode = 'P0001', message = 'invalid_observation_date';
  end if;

  with deleted as (
    delete from public.balance_snapshots as snapshot
    using public.accounts as account
    where snapshot.account_id = account.id
      and account.owner_id = observation_owner
      and snapshot.recorded_at = p_recorded_at
    returning snapshot.id
  )
  select count(*) into deleted_count from deleted;
  if deleted_count = 0 then
    raise exception using errcode = 'P0001', message = 'observation_not_found';
  end if;
  if setup_row.savings_account_id is not null
    and not exists (
      select 1
      from public.balance_snapshots
      where account_id = setup_row.savings_account_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'last_setup_observation_delete_forbidden';
  end if;

  current_year_month := to_char(
    date_trunc('month', current_timestamp at time zone setup_row.time_zone),
    'YYYY-MM'
  );
  select exists (
    select 1
    from public.monthly_milestones
    where owner_id = observation_owner
      and is_plan_path
      and year_month = current_year_month
  ) into has_current_path;

  if setup_row.plan_activated_at is not null then
    if not has_current_path then
      raise exception using errcode = 'P0001', message = 'plan_path_incomplete';
    end if;
    perform public.rebuild_savings_plan_path(observation_owner);
  else
    perform public.refresh_balance_observations(observation_owner);
  end if;

  return jsonb_build_object(
    'recorded_at', p_recorded_at,
    'deleted_count', deleted_count
  );
end;
$function$;

revoke all on function public.save_balance_observations(date, jsonb)
  from public, anon;
revoke all on function public.delete_balance_observations(date)
  from public, anon;
grant execute on function public.save_balance_observations(date, jsonb)
  to authenticated;
grant execute on function public.delete_balance_observations(date)
  to authenticated;

create or replace function public.get_sop_display_records(
  p_year_month text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  display_owner uuid := auth.uid();
  display_records jsonb;
begin
  if display_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  if p_year_month is null
    or p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
  then
    raise exception using errcode = 'P0001', message = 'invalid_year_month';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', record.id,
        'year_month', record.year_month,
        'step_label', record.step_label,
        'due_day', record.due_day,
        'completed', record.completed,
        'completed_at', record.completed_at,
        'amount', record.amount,
        'note', record.note,
        'scheduled_for', record.scheduled_for,
        'source_account_name', case
          when record.is_monthly_action then record.source_account_name
          else source_account.name
        end,
        'target_account_name', case
          when record.is_monthly_action then record.target_account_name
          else target_account.name
        end,
        'is_ad_hoc', (
          not record.is_monthly_action
          and record.template_id is null
        )
      ) order by record.sort_order, record.id
    ),
    '[]'::jsonb
  ) into display_records
  from public.sop_records as record
  left join public.sop_templates as template
    on template.owner_id = record.owner_id
    and template.id = record.template_id
  left join public.accounts as source_account
    on source_account.owner_id = record.owner_id
    and source_account.id = template.from_account_id
  left join public.accounts as target_account
    on target_account.owner_id = record.owner_id
    and target_account.id = template.to_account_id
  where record.owner_id = display_owner
    and record.year_month = p_year_month;

  return display_records;
end;
$function$;

revoke all on function public.get_sop_display_records(text)
  from public, anon;
grant execute on function public.get_sop_display_records(text)
  to authenticated;

commit;
