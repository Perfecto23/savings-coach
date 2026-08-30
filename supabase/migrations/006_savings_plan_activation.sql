begin;

alter table public.sop_templates
  add column is_plan_rule boolean not null default false;

alter table public.sop_records
  add column is_monthly_action boolean not null default false,
  add column rule_amount numeric(12,2),
  add column scheduled_for date,
  add column source_account_id uuid,
  add column source_account_name text,
  add column target_account_id uuid,
  add column target_account_name text;

alter table public.monthly_milestones
  add column is_plan_path boolean not null default false;

alter table public.owner_setup
  add column plan_activated_at timestamptz;

create or replace function public.plan_scheduled_date(
  p_month_start date,
  p_due_day integer
)
returns date
language sql
immutable
strict
set search_path = ''
as $function$
  select least(
    p_month_start + (p_due_day - 1),
    (p_month_start + interval '1 month - 1 day')::date
  );
$function$;

-- Existing data is projected conservatively. Migration does not activate a
-- plan or rewrite any historical completion state.
update public.sop_templates as template
set is_plan_rule = true
from public.owner_setup as setup
join public.accounts as target
  on target.owner_id = setup.owner_id
  and target.id = setup.savings_account_id
  and target.purpose = 'savings'
where template.owner_id = setup.owner_id
  and template.is_active
  and template.to_account_id = target.id
  and template.default_amount > 0;

update public.sop_records as action
set
  is_monthly_action = true,
  rule_amount = coalesce(action.milestone_amount, action.amount),
  scheduled_for = public.plan_scheduled_date(
    to_date(action.year_month || '-01', 'YYYY-MM-DD'),
    action.due_day
  ),
  source_account_id = template.from_account_id,
  source_account_name = source_account.name,
  target_account_id = template.to_account_id,
  target_account_name = target_account.name
from public.sop_templates as template
left join public.accounts as source_account
  on source_account.owner_id = template.owner_id
  and source_account.id = template.from_account_id
left join public.accounts as target_account
  on target_account.owner_id = template.owner_id
  and target_account.id = template.to_account_id
where action.owner_id = template.owner_id
  and action.template_id = template.id
  and action.counts_toward_milestone
  and coalesce(action.milestone_amount, action.amount) > 0;

-- A template may have been deleted after migration 003. Preserve a positive
-- milestone record as a Monthly Action even when live account links are gone.
update public.sop_records as action
set
  is_monthly_action = true,
  rule_amount = coalesce(action.milestone_amount, action.amount),
  scheduled_for = public.plan_scheduled_date(
    to_date(action.year_month || '-01', 'YYYY-MM-DD'),
    action.due_day
  )
where not action.is_monthly_action
  and action.counts_toward_milestone
  and coalesce(action.milestone_amount, action.amount) > 0;

do $monthly_action_duplicate_preflight$
begin
  if exists (
    select 1
    from public.sop_records
    where is_monthly_action
      and template_id is not null
    group by owner_id, template_id, year_month
    having count(*) > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'monthly_action_duplicate_preflight_failed';
  end if;
end;
$monthly_action_duplicate_preflight$;

alter table public.sop_templates
  add constraint sop_templates_plan_rule_amount_check
    check (not is_plan_rule or default_amount > 0),
  add constraint sop_templates_due_day_check
    check (due_day between 1 and 31);

alter table public.sop_records
  add constraint sop_records_monthly_action_amount_check
    check (not is_monthly_action or rule_amount > 0),
  add constraint sop_records_source_account_fkey
    foreign key (owner_id, source_account_id)
    references public.accounts(owner_id, id)
    on delete set null (source_account_id),
  add constraint sop_records_target_account_fkey
    foreign key (owner_id, target_account_id)
    references public.accounts(owner_id, id)
    on delete set null (target_account_id);

create unique index sop_records_owner_rule_month_action_key
  on public.sop_records(owner_id, template_id, year_month)
  where is_monthly_action and template_id is not null;

create index idx_sop_templates_owner_plan_rule
  on public.sop_templates(owner_id, is_plan_rule, is_active, sort_order);
create index idx_sop_records_owner_plan_action_month
  on public.sop_records(owner_id, is_monthly_action, year_month, scheduled_for);
create index idx_monthly_milestones_owner_plan_path
  on public.monthly_milestones(owner_id, is_plan_path, year_month);

create or replace function public.validate_plan_rule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  setup_target uuid;
begin
  if not new.is_plan_rule then
    return new;
  end if;

  if new.default_amount is null
    or new.default_amount::text in ('NaN', 'Infinity', '-Infinity')
    or new.default_amount <= 0
    or new.default_amount > 9999999999.99
    or scale(new.default_amount) > 2
  then
    raise exception using errcode = 'P0001', message = 'invalid_rule_amount';
  end if;
  if new.due_day < 1 or new.due_day > 31 then
    raise exception using errcode = 'P0001', message = 'invalid_due_day';
  end if;

  select savings_account_id into setup_target
  from public.owner_setup
  where owner_id = new.owner_id;

  if new.is_active is null then
    raise exception using errcode = 'P0001', message = 'invalid_rule';
  end if;
  if new.is_active and (setup_target is null or new.to_account_id is distinct from setup_target) then
    raise exception using errcode = 'P0001', message = 'target_account_mismatch';
  end if;
  if new.to_account_id is not null and new.to_account_id is distinct from setup_target then
    raise exception using errcode = 'P0001', message = 'target_account_mismatch';
  end if;

  return new;
end;
$function$;

create trigger sop_templates_validate_plan_rule
before insert or update of is_plan_rule, is_active, default_amount, due_day, to_account_id
on public.sop_templates
for each row execute function public.validate_plan_rule();

create or replace function public.deactivate_rules_for_deleted_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  owner_time_zone text;
  owner_current_month text;
begin
  update public.sop_templates
  set is_active = false, to_account_id = null
  where owner_id = old.owner_id
    and is_plan_rule
    and to_account_id = old.id;

  select time_zone into owner_time_zone
  from public.owner_setup
  where owner_id = old.owner_id
    and savings_account_id = old.id;

  if owner_time_zone is not null then
    owner_current_month := to_char(
      date_trunc('month', current_timestamp at time zone owner_time_zone),
      'YYYY-MM'
    );
    update public.monthly_milestones
    set is_plan_path = false
    where owner_id = old.owner_id
      and is_plan_path
      and year_month >= owner_current_month;
  end if;
  return old;
end;
$function$;

create trigger accounts_deactivate_plan_rules_before_delete
before delete on public.accounts
for each row execute function public.deactivate_rules_for_deleted_account();

create or replace function public.protect_plan_rule_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.sop_records
    where owner_id = old.owner_id
      and template_id = old.id
      and is_monthly_action
  ) then
    raise exception using errcode = 'P0001', message = 'rule_has_monthly_actions';
  end if;
  return old;
end;
$function$;

create trigger sop_templates_protect_plan_rule_delete
before delete on public.sop_templates
for each row execute function public.protect_plan_rule_delete();

create or replace function public.protect_monthly_action_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not old.is_monthly_action then
    return new;
  end if;

  if not new.is_monthly_action
    or new.template_id is distinct from old.template_id
    or new.year_month is distinct from old.year_month
    or new.step_key is distinct from old.step_key
    or new.step_label is distinct from old.step_label
    or new.due_day is distinct from old.due_day
    or new.scheduled_for is distinct from old.scheduled_for
    or new.rule_amount is distinct from old.rule_amount
    or new.source_account_name is distinct from old.source_account_name
    or new.target_account_name is distinct from old.target_account_name
    or (
      new.source_account_id is distinct from old.source_account_id
      and new.source_account_id is not null
    )
    or (
      new.target_account_id is distinct from old.target_account_id
      and new.target_account_id is not null
    )
  then
    raise exception using errcode = 'P0001', message = 'monthly_action_snapshot_locked';
  end if;

  return new;
end;
$function$;

create trigger sop_records_protect_monthly_action_snapshot
before update on public.sop_records
for each row execute function public.protect_monthly_action_snapshot();

-- plan_activated_at is written only by the activation RPC.
revoke update on public.owner_setup from authenticated;
revoke insert on public.owner_setup from authenticated;
grant update (locale, time_zone, base_currency, savings_account_id)
  on public.owner_setup to authenticated;
grant insert (owner_id, locale, time_zone, base_currency, savings_account_id)
  on public.owner_setup to authenticated;

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

  select snapshot.balance into baseline
  from public.balance_snapshots as snapshot
  where snapshot.account_id = setup_row.savings_account_id
    and snapshot.recorded_at <= local_today
  order by snapshot.recorded_at desc, snapshot.created_at desc
  limit 1;
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
      coalesce(sum(coalesce(action.milestone_amount, action.amount)), 0)::numeric(12,2) as amount,
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
      coalesce(sum(coalesce(bonus.actual_amount, bonus.amount)), 0)::numeric(12,2) as amount
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
        baseline + sum(planned_savings) over (order by month_start rows unbounded preceding)
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
  return path_payload;
end;
$function$;

revoke all on function public.rebuild_savings_plan_path(uuid)
  from public, anon, authenticated;

create or replace function public.save_plan_rule(p_rule jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  plan_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  rule_id uuid;
  rule_name text;
  rule_amount numeric(12,2);
  due_day integer;
  source_id uuid;
  target_id uuid;
  existing_owner uuid;
  existing_active boolean;
  existing_is_plan_rule boolean;
  written_owner uuid;
begin
  if plan_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(plan_owner::text, 0));

  select * into setup_row from public.owner_setup where owner_id = plan_owner;
  if not found or setup_row.savings_account_id is null then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  begin
    rule_id := (p_rule ->> 'rule_id')::uuid;
    rule_amount := (p_rule ->> 'amount')::numeric;
    due_day := (p_rule ->> 'due_day')::integer;
    target_id := (p_rule ->> 'target_account_id')::uuid;
    if nullif(p_rule ->> 'source_account_id', '') is not null then
      source_id := (p_rule ->> 'source_account_id')::uuid;
    end if;
  exception when others then
    raise exception using errcode = 'P0001', message = 'invalid_rule';
  end;
  rule_name := btrim(p_rule ->> 'name');

  if rule_name is null or rule_name = '' or char_length(rule_name) > 100
    or rule_amount is null
    or rule_amount::text in ('NaN', 'Infinity', '-Infinity')
    or rule_amount <= 0
    or rule_amount > 9999999999.99
    or scale(rule_amount) > 2
    or due_day < 1 or due_day > 31
  then
    raise exception using errcode = 'P0001', message = 'invalid_rule';
  end if;
  if target_id is distinct from setup_row.savings_account_id then
    raise exception using errcode = 'P0001', message = 'target_account_mismatch';
  end if;
  if source_id is not null and not exists (
    select 1 from public.accounts where owner_id = plan_owner and id = source_id
  ) then
    raise exception using errcode = 'P0001', message = 'account_not_found';
  end if;

  select owner_id, is_active, is_plan_rule
  into existing_owner, existing_active, existing_is_plan_rule
  from public.sop_templates where id = rule_id;
  if found and existing_owner is distinct from plan_owner then
    raise exception using errcode = 'P0001', message = 'rule_not_found';
  end if;
  if found and not existing_is_plan_rule then
    raise exception using errcode = 'P0001', message = 'rule_not_found';
  end if;

  insert into public.sop_templates (
    id, owner_id, step_key, step_label, due_day,
    from_account_id, to_account_id, default_amount,
    sort_order, is_active, is_plan_rule
  ) values (
    rule_id,
    plan_owner,
    'plan_rule_' || replace(rule_id::text, '-', ''),
    rule_name,
    due_day,
    source_id,
    target_id,
    rule_amount,
    (select coalesce(max(sort_order), -1) + 1 from public.sop_templates where owner_id = plan_owner),
    coalesce(existing_active, true),
    true
  )
  on conflict (id) do update
  set
    step_label = excluded.step_label,
    due_day = excluded.due_day,
    from_account_id = excluded.from_account_id,
    to_account_id = excluded.to_account_id,
    default_amount = excluded.default_amount,
    is_active = coalesce(sop_templates.is_active, true),
    is_plan_rule = true
  where sop_templates.owner_id = plan_owner
  returning owner_id into written_owner;

  if not found or written_owner is distinct from plan_owner then
    raise exception using errcode = 'P0001', message = 'rule_not_found';
  end if;

  if exists (
    select 1
    from public.monthly_milestones as path
    where path.owner_id = plan_owner
      and path.is_plan_path
      and path.year_month = to_char(
        date_trunc('month', current_timestamp at time zone setup_row.time_zone),
        'YYYY-MM'
      )
  ) then
    perform public.rebuild_savings_plan_path(plan_owner);
  end if;

  return jsonb_build_object(
    'rule_id', rule_id,
    'name', rule_name,
    'amount', rule_amount,
    'due_day', due_day,
    'source_account_id', source_id,
    'target_account_id', target_id,
    'active', coalesce(existing_active, true)
  );
end;
$function$;

create or replace function public.set_plan_rule_active(
  p_rule_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  plan_owner uuid := auth.uid();
  updated_rule public.sop_templates%rowtype;
  activated_at timestamptz;
  owner_time_zone text;
begin
  if plan_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  if p_active is null then
    raise exception using errcode = 'P0001', message = 'invalid_rule';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(plan_owner::text, 0));

  update public.sop_templates
  set is_active = p_active
  where owner_id = plan_owner and id = p_rule_id and is_plan_rule
  returning * into updated_rule;
  if not found then
    raise exception using errcode = 'P0001', message = 'rule_not_found';
  end if;

  select plan_activated_at, time_zone into activated_at, owner_time_zone
  from public.owner_setup where owner_id = plan_owner;
  if exists (
    select 1
    from public.monthly_milestones as path
    where path.owner_id = plan_owner
      and path.is_plan_path
      and path.year_month = to_char(
        date_trunc('month', current_timestamp at time zone owner_time_zone),
        'YYYY-MM'
      )
  ) then
    perform public.rebuild_savings_plan_path(plan_owner);
  end if;

  return jsonb_build_object('rule_id', updated_rule.id, 'active', updated_rule.is_active);
end;
$function$;

create or replace function public.activate_savings_plan()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  plan_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  local_today date;
  current_month date;
  current_year_month text;
  active_rule_count integer;
  rule_row public.sop_templates%rowtype;
  existing_action public.sop_records%rowtype;
  source_name text;
  target_name text;
  path_payload jsonb;
  activation_time timestamptz;
  next_action jsonb;
  current_total numeric(12,2);
  has_current_path boolean;
begin
  if plan_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(plan_owner::text, 0));

  select * into setup_row from public.owner_setup where owner_id = plan_owner for update;
  if not found or setup_row.savings_account_id is null or not exists (
    select 1 from public.accounts
    where owner_id = plan_owner and id = setup_row.savings_account_id and purpose = 'savings'
  ) or not exists (
    select 1 from public.balance_snapshots
    where account_id = setup_row.savings_account_id
  ) then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  select count(*) into active_rule_count
  from public.sop_templates
  where owner_id = plan_owner and is_plan_rule and is_active;
  local_today := (current_timestamp at time zone setup_row.time_zone)::date;
  current_month := date_trunc('month', local_today)::date;
  current_year_month := to_char(current_month, 'YYYY-MM');

  select exists (
    select 1
    from public.monthly_milestones
    where owner_id = plan_owner
      and is_plan_path
      and year_month = current_year_month
  ) into has_current_path;

  if not has_current_path and active_rule_count = 0 then
    raise exception using errcode = 'P0001', message = 'no_active_plan_rules';
  end if;

  for rule_row in
    select * from public.sop_templates
    where owner_id = plan_owner and is_plan_rule and is_active
    order by sort_order, id
  loop
    select * into existing_action
    from public.sop_records
    where owner_id = plan_owner
      and template_id = rule_row.id
      and year_month = current_year_month
    limit 1;

    if found then
      if not existing_action.is_monthly_action then
        raise exception using errcode = 'P0001', message = 'legacy_action_conflict';
      end if;
      continue;
    end if;

    if exists (
      select 1 from public.sop_records
      where owner_id = plan_owner
        and year_month = current_year_month
        and step_key = rule_row.step_key
    ) then
      raise exception using errcode = 'P0001', message = 'legacy_action_conflict';
    end if;

    select name into source_name from public.accounts
    where owner_id = plan_owner and id = rule_row.from_account_id;
    select name into target_name from public.accounts
    where owner_id = plan_owner and id = rule_row.to_account_id;

    insert into public.sop_records (
      owner_id, year_month, template_id, step_key, step_label,
      due_day, amount, sort_order, counts_toward_milestone,
      milestone_amount, is_monthly_action, rule_amount, scheduled_for,
      source_account_id, source_account_name,
      target_account_id, target_account_name
    ) values (
      plan_owner,
      current_year_month,
      rule_row.id,
      rule_row.step_key,
      rule_row.step_label,
      rule_row.due_day,
      rule_row.default_amount,
      rule_row.sort_order,
      true,
      rule_row.default_amount,
      true,
      rule_row.default_amount,
      public.plan_scheduled_date(current_month, rule_row.due_day),
      rule_row.from_account_id,
      source_name,
      rule_row.to_account_id,
      target_name
    );
  end loop;

  path_payload := public.rebuild_savings_plan_path(plan_owner);

  update public.owner_setup
  set plan_activated_at = coalesce(plan_activated_at, current_timestamp)
  where owner_id = plan_owner
  returning plan_activated_at into activation_time;

  select planned_savings
  into current_total
  from public.monthly_milestones
  where owner_id = plan_owner
    and is_plan_path
    and year_month = current_year_month;

  select jsonb_build_object(
    'id', id,
    'name', step_label,
    'amount', coalesce(milestone_amount, amount),
    'scheduled_for', scheduled_for,
    'overdue', scheduled_for < local_today and not completed
  ) into next_action
  from public.sop_records
  where owner_id = plan_owner
    and is_monthly_action
    and year_month = current_year_month
    and not completed
  order by scheduled_for, sort_order, id
  limit 1;

  return jsonb_build_object(
    'plan_activated_at', activation_time,
    'base_currency', setup_row.base_currency,
    'monthly_planned_transfer', current_total,
    'savings_account', (
      select jsonb_build_object('id', id, 'name', name)
      from public.accounts
      where owner_id = plan_owner and id = setup_row.savings_account_id
    ),
    'next_action', next_action,
    'path', path_payload
  );
end;
$function$;

create or replace function public.update_monthly_action(
  p_action_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  plan_owner uuid := auth.uid();
  action_row public.sop_records%rowtype;
  updated_action public.sop_records%rowtype;
  setup_time_zone text;
  current_year_month text;
  has_amount boolean;
  has_completed boolean;
  has_note boolean;
  next_amount numeric(12,2);
  next_completed boolean;
  next_note text;
begin
  if plan_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(plan_owner::text, 0));

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'invalid_action_patch';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_keys(key)
    where patch_keys.key not in ('amount', 'completed', 'note')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_action_patch';
  end if;

  select * into action_row
  from public.sop_records
  where owner_id = plan_owner
    and id = p_action_id
    and is_monthly_action
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'monthly_action_not_found';
  end if;

  has_amount := p_patch ? 'amount';
  has_completed := p_patch ? 'completed';
  has_note := p_patch ? 'note';

  if has_amount then
    begin
      next_amount := (p_patch ->> 'amount')::numeric;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_action_amount';
    end;
    if next_amount is null
      or next_amount::text in ('NaN', 'Infinity', '-Infinity')
      or next_amount <= 0
      or next_amount > 9999999999.99
      or scale(next_amount) > 2
    then
      raise exception using errcode = 'P0001', message = 'invalid_action_amount';
    end if;
  else
    next_amount := action_row.amount;
  end if;

  if has_completed then
    if jsonb_typeof(p_patch -> 'completed') <> 'boolean' then
      raise exception using errcode = 'P0001', message = 'invalid_action_completed';
    end if;
    next_completed := (p_patch ->> 'completed')::boolean;
  else
    next_completed := action_row.completed;
  end if;

  if has_note then
    if p_patch -> 'note' = 'null'::jsonb then
      next_note := null;
    elsif jsonb_typeof(p_patch -> 'note') = 'string' then
      next_note := p_patch ->> 'note';
      if char_length(next_note) > 1000 then
        raise exception using errcode = 'P0001', message = 'invalid_action_note';
      end if;
    else
      raise exception using errcode = 'P0001', message = 'invalid_action_note';
    end if;
  else
    next_note := action_row.note;
  end if;

  update public.sop_records
  set
    amount = next_amount,
    milestone_amount = case when has_amount then next_amount else milestone_amount end,
    completed = next_completed,
    completed_at = case
      when not has_completed then completed_at
      when next_completed and action_row.completed then action_row.completed_at
      when next_completed then current_timestamp
      else null
    end,
    note = next_note
  where owner_id = plan_owner
    and id = p_action_id
    and is_monthly_action
  returning * into updated_action;

  select time_zone into setup_time_zone
  from public.owner_setup
  where owner_id = plan_owner;
  current_year_month := to_char(
    date_trunc('month', current_timestamp at time zone setup_time_zone),
    'YYYY-MM'
  );

  if exists (
    select 1
    from public.monthly_milestones
    where owner_id = plan_owner
      and is_plan_path
      and year_month = current_year_month
  ) then
    perform public.rebuild_savings_plan_path(plan_owner);
  end if;

  return jsonb_build_object(
    'id', updated_action.id,
    'name', updated_action.step_label,
    'amount', updated_action.amount,
    'note', updated_action.note,
    'completed', updated_action.completed,
    'completed_at', updated_action.completed_at,
    'scheduled_for', updated_action.scheduled_for
  );
end;
$function$;

revoke all on function public.save_plan_rule(jsonb) from public, anon;
revoke all on function public.set_plan_rule_active(uuid, boolean) from public, anon;
revoke all on function public.activate_savings_plan() from public, anon;
revoke all on function public.update_monthly_action(uuid, jsonb) from public, anon;
grant execute on function public.save_plan_rule(jsonb) to authenticated;
grant execute on function public.set_plan_rule_active(uuid, boolean) to authenticated;
grant execute on function public.activate_savings_plan() to authenticated;
grant execute on function public.update_monthly_action(uuid, jsonb) to authenticated;

commit;
