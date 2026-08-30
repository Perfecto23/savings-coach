begin;

alter table public.owner_setup
  add column behavior_activated_at timestamptz,
  add constraint owner_setup_behavior_activation_order_check
    check (
      behavior_activated_at is null
      or (
        plan_activated_at is not null
        and behavior_activated_at >= plan_activated_at
      )
    );

drop policy if exists sop_records_owner_insert on public.sop_records;
drop policy if exists sop_records_owner_update on public.sop_records;
drop policy if exists sop_records_owner_delete on public.sop_records;

create policy sop_records_owner_insert
on public.sop_records for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and not is_monthly_action
);

create policy sop_records_owner_update
on public.sop_records for update to authenticated
using (
  (select auth.uid()) = owner_id
  and not is_monthly_action
)
with check (
  (select auth.uid()) = owner_id
  and not is_monthly_action
);

create policy sop_records_owner_delete
on public.sop_records for delete to authenticated
using (
  (select auth.uid()) = owner_id
  and not is_monthly_action
);

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
  setup_row public.owner_setup%rowtype;
  current_year_month text;
  has_current_path boolean;
  has_amount boolean;
  has_completed boolean;
  has_note boolean;
  next_amount numeric(12,2);
  next_completed boolean;
  next_note text;
  behavior_activated_now boolean := false;
begin
  if plan_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(plan_owner::text, 0)
  );

  if p_patch is null
    or jsonb_typeof(p_patch) <> 'object'
    or p_patch = '{}'::jsonb
  then
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

  select * into setup_row
  from public.owner_setup
  where owner_id = plan_owner
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
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

  current_year_month := to_char(
    date_trunc('month', current_timestamp at time zone setup_row.time_zone),
    'YYYY-MM'
  );
  select exists (
    select 1
    from public.monthly_milestones
    where owner_id = plan_owner
      and is_plan_path
      and year_month = current_year_month
  ) into has_current_path;

  if has_current_path then
    perform public.rebuild_savings_plan_path(plan_owner);
  elsif setup_row.plan_activated_at is not null
    and action_row.year_month = current_year_month
    and has_completed
    and next_completed
  then
    raise exception using errcode = 'P0001', message = 'plan_path_incomplete';
  end if;

  if has_current_path
    and setup_row.plan_activated_at is not null
    and setup_row.behavior_activated_at is null
    and action_row.year_month = current_year_month
    and action_row.counts_toward_milestone
    and has_completed
    and not action_row.completed
    and next_completed
  then
    update public.owner_setup
    set behavior_activated_at = current_timestamp
    where owner_id = plan_owner
      and behavior_activated_at is null;
    behavior_activated_now := found;
  end if;

  return jsonb_build_object(
    'id', updated_action.id,
    'name', updated_action.step_label,
    'amount', updated_action.amount,
    'note', updated_action.note,
    'completed', updated_action.completed,
    'completed_at', updated_action.completed_at,
    'scheduled_for', updated_action.scheduled_for,
    'behavior_activated_now', behavior_activated_now
  );
end;
$function$;

revoke all on function public.update_monthly_action(uuid, jsonb)
  from public, anon;
grant execute on function public.update_monthly_action(uuid, jsonb)
  to authenticated;

commit;
