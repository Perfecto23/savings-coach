begin;

alter table public.monthly_milestones
  add column review_completed_at timestamptz,
  add constraint monthly_milestones_review_requires_plan_path_check
    check (review_completed_at is null or is_plan_path);

create index idx_monthly_milestones_owner_review
  on public.monthly_milestones(owner_id, review_completed_at, year_month);

create or replace function public.protect_reviewed_sop_records()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  caller_owner uuid := auth.uid();
  previous_owner uuid;
  previous_year_month text;
  next_owner uuid;
  next_year_month text;
  first_lock_owner uuid;
  second_lock_owner uuid;
  reviewed_month boolean;
  cleanup_only boolean := false;
begin
  if tg_op <> 'INSERT' then
    previous_owner := old.owner_id;
    previous_year_month := old.year_month;
  end if;
  if tg_op <> 'DELETE' then
    next_owner := new.owner_id;
    next_year_month := new.year_month;
  end if;

  if caller_owner is not null
    and (
      (previous_owner is not null and previous_owner <> caller_owner)
      or (next_owner is not null and next_owner <> caller_owner)
    )
  then
    raise exception using errcode = 'P0001', message = 'sop_owner_mismatch';
  end if;

  if previous_owner is null then
    first_lock_owner := next_owner;
  elsif next_owner is null or next_owner = previous_owner then
    first_lock_owner := previous_owner;
  else
    first_lock_owner := least(previous_owner, next_owner);
    second_lock_owner := greatest(previous_owner, next_owner);
  end if;

  if first_lock_owner is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(first_lock_owner::text, 0)
    );
  end if;
  if second_lock_owner is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(second_lock_owner::text, 0)
    );
  end if;

  select (
    (
      previous_owner is not null
      and exists (
        select 1
        from public.monthly_milestones as milestone
        where milestone.owner_id = previous_owner
          and milestone.year_month = previous_year_month
          and milestone.review_completed_at is not null
      )
    ) or (
      next_owner is not null
      and exists (
        select 1
        from public.monthly_milestones as milestone
        where milestone.owner_id = next_owner
          and milestone.year_month = next_year_month
          and milestone.review_completed_at is not null
      )
    )
  ) into reviewed_month;

  if reviewed_month and tg_op = 'UPDATE' then
    cleanup_only :=
      (
        to_jsonb(new)
        - array['template_id', 'source_account_id', 'target_account_id']
      ) = (
        to_jsonb(old)
        - array['template_id', 'source_account_id', 'target_account_id']
      )
      and (
        new.template_id is not distinct from old.template_id
        or (old.template_id is not null and new.template_id is null)
      )
      and (
        new.source_account_id is not distinct from old.source_account_id
        or (old.source_account_id is not null and new.source_account_id is null)
      )
      and (
        new.target_account_id is not distinct from old.target_account_id
        or (old.target_account_id is not null and new.target_account_id is null)
      )
      and (
        new.template_id is distinct from old.template_id
        or new.source_account_id is distinct from old.source_account_id
        or new.target_account_id is distinct from old.target_account_id
      );
  end if;

  if reviewed_month and not cleanup_only then
    raise exception using errcode = 'P0001', message = 'month_review_closed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create trigger sop_records_protect_reviewed_month
before insert or update or delete on public.sop_records
for each row execute function public.protect_reviewed_sop_records();

create or replace function public.protect_reviewed_milestone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.review_completed_at is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE'
    or new.owner_id is distinct from old.owner_id
    or new.year_month is distinct from old.year_month
    or new.planned_savings is distinct from old.planned_savings
    or new.planned_total_savings is distinct from old.planned_total_savings
    or new.status is distinct from old.status
    or new.is_plan_path is distinct from old.is_plan_path
    or new.review_completed_at is distinct from old.review_completed_at
  then
    raise exception using errcode = 'P0001', message = 'month_review_closed';
  end if;

  return new;
end;
$function$;

create trigger monthly_milestones_protect_reviewed_month
before update or delete on public.monthly_milestones
for each row execute function public.protect_reviewed_milestone();

create or replace function public.close_monthly_review(
  p_year_month text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  review_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  review_milestone public.monthly_milestones%rowtype;
  local_current_month date;
  expected_review_month date;
  expected_year_month text;
  current_year_month text;
  current_month_start date;
  review_action_count integer;
  completed_action_count integer;
  active_rule_count integer;
  current_action_count integer;
  created_action_count integer := 0;
  existing_action_count integer := 0;
  rule_row public.sop_templates%rowtype;
  existing_action public.sop_records%rowtype;
  source_name text;
  target_name text;
begin
  if review_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  if p_year_month is null
    or p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$'
  then
    raise exception using errcode = 'P0001', message = 'invalid_year_month';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(review_owner::text, 0)
  );

  select * into setup_row
  from public.owner_setup
  where owner_id = review_owner
  for update;
  if not found
    or setup_row.plan_activated_at is null
    or setup_row.savings_account_id is null
  then
    raise exception using errcode = 'P0001', message = 'plan_not_activated';
  end if;

  local_current_month := date_trunc(
    'month',
    current_timestamp at time zone setup_row.time_zone
  )::date;
  expected_review_month := (
    local_current_month - interval '1 month'
  )::date;
  expected_year_month := to_char(expected_review_month, 'YYYY-MM');
  current_year_month := to_char(local_current_month, 'YYYY-MM');
  current_month_start := local_current_month;

  if p_year_month <> expected_year_month then
    if p_year_month >= current_year_month then
      raise exception using errcode = 'P0001', message = 'review_month_not_elapsed';
    end if;
    raise exception using errcode = 'P0001', message = 'review_month_out_of_window';
  end if;

  select * into review_milestone
  from public.monthly_milestones
  where owner_id = review_owner
    and year_month = p_year_month
    and is_plan_path
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'review_month_not_found';
  end if;

  if review_milestone.review_completed_at is not null then
    select count(*) into existing_action_count
    from public.sop_records
    where owner_id = review_owner
      and year_month = current_year_month
      and is_monthly_action;

    return jsonb_build_object(
      'reviewed_year_month', p_year_month,
      'review_completed_at', review_milestone.review_completed_at,
      'next_year_month', current_year_month,
      'created_action_count', 0,
      'existing_action_count', existing_action_count
    );
  end if;

  select
    count(*),
    count(*) filter (where completed)
  into review_action_count, completed_action_count
  from public.sop_records
  where owner_id = review_owner
    and year_month = p_year_month
    and is_monthly_action;

  if review_action_count = 0 then
    raise exception using errcode = 'P0001', message = 'monthly_actions_missing';
  end if;
  if completed_action_count <> review_action_count then
    raise exception using errcode = 'P0001', message = 'monthly_actions_incomplete';
  end if;

  select count(*) into active_rule_count
  from public.sop_templates
  where owner_id = review_owner
    and is_plan_rule
    and is_active;
  select count(*) into current_action_count
  from public.sop_records
  where owner_id = review_owner
    and year_month = current_year_month
    and is_monthly_action;
  if active_rule_count = 0 and current_action_count = 0 then
    raise exception using errcode = 'P0001', message = 'no_active_plan_rules';
  end if;

  update public.monthly_milestones
  set
    status = 'on_track',
    review_completed_at = current_timestamp
  where owner_id = review_owner
    and year_month = p_year_month
    and is_plan_path
    and review_completed_at is null
  returning * into review_milestone;

  for rule_row in
    select *
    from public.sop_templates
    where owner_id = review_owner
      and is_plan_rule
      and is_active
    order by sort_order, id
  loop
    select * into existing_action
    from public.sop_records
    where owner_id = review_owner
      and template_id = rule_row.id
      and year_month = current_year_month
    limit 1;

    if found then
      if not existing_action.is_monthly_action then
        raise exception using errcode = 'P0001', message = 'legacy_action_conflict';
      end if;
      existing_action_count := existing_action_count + 1;
      continue;
    end if;

    if exists (
      select 1
      from public.sop_records
      where owner_id = review_owner
        and year_month = current_year_month
        and step_key = rule_row.step_key
    ) then
      raise exception using errcode = 'P0001', message = 'legacy_action_conflict';
    end if;

    select name into source_name
    from public.accounts
    where owner_id = review_owner
      and id = rule_row.from_account_id;
    select name into target_name
    from public.accounts
    where owner_id = review_owner
      and id = rule_row.to_account_id;

    insert into public.sop_records (
      owner_id,
      year_month,
      template_id,
      step_key,
      step_label,
      due_day,
      amount,
      sort_order,
      counts_toward_milestone,
      milestone_amount,
      is_monthly_action,
      rule_amount,
      scheduled_for,
      source_account_id,
      source_account_name,
      target_account_id,
      target_account_name
    ) values (
      review_owner,
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
      public.plan_scheduled_date(current_month_start, rule_row.due_day),
      rule_row.from_account_id,
      source_name,
      rule_row.to_account_id,
      target_name
    );
    created_action_count := created_action_count + 1;
  end loop;

  perform public.rebuild_savings_plan_path(review_owner);

  return jsonb_build_object(
    'reviewed_year_month', p_year_month,
    'review_completed_at', review_milestone.review_completed_at,
    'next_year_month', current_year_month,
    'created_action_count', created_action_count,
    'existing_action_count', existing_action_count
  );
end;
$function$;

revoke all on function public.close_monthly_review(text)
  from public, anon;
grant execute on function public.close_monthly_review(text)
  to authenticated;

commit;
