begin;

alter table public.owner_setup
  add column paid_intent_offer_code text,
  add column paid_intent_recorded_at timestamptz,
  add constraint owner_setup_paid_intent_pair_check
    check (
      (
        paid_intent_offer_code is null
        and paid_intent_recorded_at is null
      ) or (
        paid_intent_offer_code is not null
        and paid_intent_offer_code = 'pro_beta_usd_499_monthly_v1'
        and paid_intent_recorded_at is not null
      )
    );

create or replace function public.get_paid_intent_offer_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  is_eligible boolean;
begin
  if intent_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  select * into setup_row
  from public.owner_setup
  where owner_id = intent_owner;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  select exists (
    select 1
    from public.monthly_milestones
    where owner_id = intent_owner
      and review_completed_at is not null
  ) into is_eligible;

  return jsonb_build_object(
    'offer_code', 'pro_beta_usd_499_monthly_v1',
    'eligible', is_eligible,
    'recorded_at', setup_row.paid_intent_recorded_at
  );
end;
$function$;

create or replace function public.record_paid_intent()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
  is_eligible boolean;
begin
  if intent_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(intent_owner::text, 0)
  );

  select * into setup_row
  from public.owner_setup
  where owner_id = intent_owner
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  if setup_row.paid_intent_recorded_at is not null then
    return jsonb_build_object(
      'offer_code', setup_row.paid_intent_offer_code,
      'recorded_at', setup_row.paid_intent_recorded_at,
      'recorded_now', false
    );
  end if;

  select exists (
    select 1
    from public.monthly_milestones
    where owner_id = intent_owner
      and review_completed_at is not null
  ) into is_eligible;
  if not is_eligible then
    raise exception using errcode = 'P0001', message = 'paid_intent_not_eligible';
  end if;

  update public.owner_setup
  set
    paid_intent_offer_code = 'pro_beta_usd_499_monthly_v1',
    paid_intent_recorded_at = current_timestamp
  where owner_id = intent_owner
  returning * into setup_row;

  return jsonb_build_object(
    'offer_code', setup_row.paid_intent_offer_code,
    'recorded_at', setup_row.paid_intent_recorded_at,
    'recorded_now', true
  );
end;
$function$;

revoke all on function public.get_paid_intent_offer_state()
  from public, anon;
revoke all on function public.record_paid_intent()
  from public, anon;
grant execute on function public.get_paid_intent_offer_state()
  to authenticated;
grant execute on function public.record_paid_intent()
  to authenticated;

commit;
