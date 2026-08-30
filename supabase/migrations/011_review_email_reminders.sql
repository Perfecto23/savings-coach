begin;

alter table public.owner_setup
  add column review_reminder_enabled_at timestamptz,
  add column review_reminder_unsubscribed_at timestamptz,
  add column review_reminder_unsubscribe_token uuid not null default gen_random_uuid(),
  add constraint owner_setup_review_reminder_consent_check
    check (
      review_reminder_enabled_at is null
      or review_reminder_unsubscribed_at is null
    );

create unique index owner_setup_review_reminder_unsubscribe_token_key
  on public.owner_setup(review_reminder_unsubscribe_token);

create table public.review_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  review_year_month text not null check (
    review_year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  kind text not null default 'monthly_review_email' check (
    kind = 'monthly_review_email'
  ),
  status text not null default 'pending' check (
    status in (
      'pending', 'claimed', 'sending', 'retry_wait', 'accepted', 'delivered',
      'bounced', 'complained', 'suppressed', 'cancelled', 'failed', 'unknown'
    )
  ),
  scheduled_for timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  first_attempt_at timestamptz,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  claim_token uuid,
  next_attempt_at timestamptz,
  provider_message_id text,
  provider_accepted_at timestamptz,
  provider_result_ambiguous_at timestamptz,
  provider_event_at timestamptz,
  provider_event_id text,
  delivered_at timestamptz,
  terminal_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, review_year_month, kind),
  check (
    provider_message_id is null
    or (
      char_length(provider_message_id) between 1 and 128
      and provider_message_id ~ '^[A-Za-z0-9_-]+$'
    )
  ),
  check (
    provider_event_id is null
    or (
      char_length(provider_event_id) between 1 and 256
      and provider_event_id ~ '^[A-Za-z0-9_-]+$'
    )
  ),
  check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,64}$'
  )
);

create unique index review_reminder_deliveries_provider_message_key
  on public.review_reminder_deliveries(provider_message_id)
  where provider_message_id is not null;
create index review_reminder_deliveries_claim_queue
  on public.review_reminder_deliveries(status, next_attempt_at, claim_expires_at);

alter table public.review_reminder_deliveries enable row level security;
revoke all privileges on table public.review_reminder_deliveries
  from anon, authenticated, service_role;

create trigger review_reminder_deliveries_updated_at
before update on public.review_reminder_deliveries
for each row execute function public.update_updated_at();

create or replace function public.configure_review_email_reminder(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reminder_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
begin
  if reminder_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  if p_enabled is null then
    raise exception using errcode = 'P0001', message = 'invalid_reminder_preference';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(reminder_owner::text, 0)
  );

  select * into setup_row
  from public.owner_setup
  where owner_id = reminder_owner
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  if p_enabled and not exists (
    select 1 from auth.users
    where id = reminder_owner
      and email is not null
      and email_confirmed_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'confirmed_email_required';
  end if;

  update public.owner_setup
  set
    review_reminder_enabled_at = case when p_enabled then current_timestamp else null end,
    review_reminder_unsubscribed_at = case
      when p_enabled then null
      when setup_row.review_reminder_enabled_at is not null then current_timestamp
      else setup_row.review_reminder_unsubscribed_at
    end
  where owner_id = reminder_owner
  returning * into setup_row;

  if not p_enabled then
    update public.review_reminder_deliveries
    set status = 'cancelled', terminal_at = current_timestamp,
      claim_token = null, claimed_at = null, claim_expires_at = null
    where owner_id = reminder_owner
      and status in ('pending', 'claimed', 'retry_wait');
  end if;

  return jsonb_build_object(
    'enabled', setup_row.review_reminder_enabled_at is not null,
    'schedule_day', 2,
    'schedule_local_time', '09:00:00'
  );
end;
$function$;

create or replace function public.get_review_email_reminder_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reminder_owner uuid := auth.uid();
  setup_row public.owner_setup%rowtype;
begin
  if reminder_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;
  select * into setup_row from public.owner_setup where owner_id = reminder_owner;
  if not found then
    raise exception using errcode = 'P0001', message = 'setup_incomplete';
  end if;

  return jsonb_build_object(
    'enabled', setup_row.review_reminder_enabled_at is not null,
    'schedule_day', 2,
    'schedule_local_time', '09:00:00'
  );
end;
$function$;

create or replace function public.claim_review_email_reminders_at(
  p_now timestamptz,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  candidate record;
  delivery_row public.review_reminder_deliveries%rowtype;
  claimed_payload jsonb := '[]'::jsonb;
  local_now timestamp;
  review_month text;
  scheduled_at timestamptz;
  still_eligible boolean;
begin
  if p_now is null or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = 'P0001', message = 'invalid_claim_request';
  end if;

  for candidate in
    select setup.owner_id, setup.time_zone
    from public.owner_setup as setup
    join auth.users as auth_user on auth_user.id = setup.owner_id
    where setup.review_reminder_enabled_at is not null
      and auth_user.email is not null
      and auth_user.email_confirmed_at is not null
    order by setup.owner_id
  loop
    local_now := p_now at time zone candidate.time_zone;
    if extract(day from local_now) < 2
      or (extract(day from local_now) = 2 and local_now::time < '09:00:00'::time)
    then
      continue;
    end if;
    review_month := to_char(date_trunc('month', local_now) - interval '1 month', 'YYYY-MM');
    scheduled_at := (
      date_trunc('month', local_now)::date + interval '1 day' + interval '9 hours'
    )::timestamp at time zone candidate.time_zone;
    if exists (
      select 1 from public.monthly_milestones as milestone
      where milestone.owner_id = candidate.owner_id
        and milestone.year_month = review_month
        and milestone.is_plan_path
        and milestone.review_completed_at is null
        and exists (
          select 1 from public.sop_records as action
          where action.owner_id = candidate.owner_id
            and action.year_month = review_month
            and action.is_monthly_action
        )
    ) then
      insert into public.review_reminder_deliveries (
        owner_id, review_year_month, status, scheduled_for, next_attempt_at
      ) values (candidate.owner_id, review_month, 'pending', scheduled_at, p_now)
      on conflict (owner_id, review_year_month, kind) do nothing;
    end if;
  end loop;

  for delivery_row in
    select * from public.review_reminder_deliveries
    where (
      status = 'pending'
      or (status = 'retry_wait' and next_attempt_at <= p_now)
      or (status = 'claimed' and claim_expires_at <= p_now)
      or (
        status = 'sending'
        and (
          next_attempt_at <= p_now
          or (next_attempt_at is null and claim_expires_at <= p_now)
        )
      )
    )
    order by created_at, id
    for update skip locked
    limit p_limit
  loop
    if delivery_row.status <> 'sending' then
      select exists (
        select 1
        from public.owner_setup as setup
        join auth.users as auth_user on auth_user.id = setup.owner_id
        join public.monthly_milestones as milestone
          on milestone.owner_id = setup.owner_id
          and milestone.year_month = delivery_row.review_year_month
          and milestone.is_plan_path
          and milestone.review_completed_at is null
        where setup.owner_id = delivery_row.owner_id
          and setup.review_reminder_enabled_at is not null
          and auth_user.email is not null
          and auth_user.email_confirmed_at is not null
          and exists (
            select 1 from public.sop_records as action
            where action.owner_id = delivery_row.owner_id
              and action.year_month = delivery_row.review_year_month
              and action.is_monthly_action
          )
      ) into still_eligible;

      if not still_eligible then
        update public.review_reminder_deliveries
        set status = 'cancelled', terminal_at = p_now,
          claim_token = null, claimed_at = null, claim_expires_at = null
        where id = delivery_row.id;
        continue;
      end if;
    end if;
    if delivery_row.attempt_count >= 3 then
      update public.review_reminder_deliveries
      set status = case when delivery_row.status = 'sending' then 'unknown' else 'failed' end,
        terminal_at = p_now,
        last_error_code = case
          when delivery_row.status = 'sending' then 'ambiguous_attempt_limit'
          else 'attempt_limit'
        end,
        claim_token = null, claimed_at = null, claim_expires_at = null
      where id = delivery_row.id;
      continue;
    end if;
    if delivery_row.first_attempt_at is not null
      and p_now >= delivery_row.first_attempt_at + interval '23 hours'
    then
      update public.review_reminder_deliveries
      set status = 'unknown', terminal_at = p_now,
        last_error_code = 'idempotency_window_expired'
      where id = delivery_row.id;
      continue;
    end if;

    update public.review_reminder_deliveries
    set status = case when delivery_row.status = 'sending' then 'sending' else 'claimed' end,
      provider_result_ambiguous_at = case
        when delivery_row.status = 'sending'
          then coalesce(provider_result_ambiguous_at, p_now)
        else provider_result_ambiguous_at
      end,
      attempt_count = attempt_count + 1,
      first_attempt_at = coalesce(first_attempt_at, p_now),
      claimed_at = p_now, claim_expires_at = p_now + interval '5 minutes',
      claim_token = gen_random_uuid(), next_attempt_at = null
    where id = delivery_row.id
    returning * into delivery_row;

    claimed_payload := claimed_payload || jsonb_build_array(jsonb_build_object(
      'delivery_id', delivery_row.id,
      'claim_token', delivery_row.claim_token,
      'review_year_month', delivery_row.review_year_month,
      'scheduled_for', delivery_row.scheduled_for,
      'attempt_count', delivery_row.attempt_count,
      'first_attempt_at', delivery_row.first_attempt_at
    ));
  end loop;

  return claimed_payload;
end;
$function$;

create or replace function public.claim_review_email_reminders(p_limit integer)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select public.claim_review_email_reminders_at(current_timestamp, p_limit);
$function$;

create or replace function public.authorize_review_email_reminder_send(
  p_delivery_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  delivery_row public.review_reminder_deliveries%rowtype;
  delivery_owner uuid;
  setup_row public.owner_setup%rowtype;
  recipient_email text;
  updated_delivery public.review_reminder_deliveries%rowtype;
begin
  select owner_id into delivery_owner from public.review_reminder_deliveries
  where id = p_delivery_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'delivery_claim_not_found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(delivery_owner::text, 0)
  );
  select * into delivery_row from public.review_reminder_deliveries
  where id = p_delivery_id for update;
  select * into setup_row from public.owner_setup
  where owner_id = delivery_row.owner_id for update;

  if delivery_row.status not in ('claimed', 'sending')
    or delivery_row.claim_token is distinct from p_claim_token
    or delivery_row.claim_expires_at < current_timestamp
  then
    raise exception using errcode = 'P0001', message = 'delivery_claim_not_found';
  end if;
  if delivery_row.status = 'claimed' and (
    setup_row.review_reminder_enabled_at is null
    or exists (
      select 1 from public.monthly_milestones
      where owner_id = delivery_row.owner_id
        and year_month = delivery_row.review_year_month
        and review_completed_at is not null
    )
  )
  then
    update public.review_reminder_deliveries
    set status = 'cancelled', terminal_at = current_timestamp,
      claim_token = null, claimed_at = null, claim_expires_at = null
    where id = delivery_row.id;
    return jsonb_build_object('authorized', false);
  end if;

  select email into recipient_email from auth.users
  where id = delivery_row.owner_id and email_confirmed_at is not null;
  if recipient_email is null then
    update public.review_reminder_deliveries
    set status = case when delivery_row.status = 'sending' then 'unknown' else 'cancelled' end,
      terminal_at = current_timestamp,
      last_error_code = case
        when delivery_row.status = 'sending' then 'recovery_recipient_unavailable'
        else 'confirmed_email_required'
      end,
      claim_token = null, claimed_at = null, claim_expires_at = null
    where id = delivery_row.id;
    return jsonb_build_object('authorized', false);
  end if;

  if delivery_row.status = 'claimed' then
    update public.review_reminder_deliveries
    set status = 'sending'
    where id = delivery_row.id
    returning * into updated_delivery;
    delivery_row := updated_delivery;
  end if;

  return jsonb_build_object(
    'authorized', true,
    'delivery_id', delivery_row.id,
    'claim_token', delivery_row.claim_token,
    'recipient_email', recipient_email,
    'locale', setup_row.locale,
    'review_year_month', delivery_row.review_year_month,
    'review_href', '/milestones/' || delivery_row.review_year_month || '/report',
    'unsubscribe_token', setup_row.review_reminder_unsubscribe_token
  );
end;
$function$;

create or replace function public.finalize_review_email_reminder(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_provider_message_id text,
  p_error_code text,
  p_next_attempt_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  delivery_row public.review_reminder_deliveries%rowtype;
  delivery_owner uuid;
  next_status text;
begin
  select owner_id into delivery_owner from public.review_reminder_deliveries
  where id = p_delivery_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'delivery_claim_not_found';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(delivery_owner::text, 0)
  );
  select * into delivery_row from public.review_reminder_deliveries
  where id = p_delivery_id for update;
  if delivery_row.status <> 'sending'
    or delivery_row.claim_token is distinct from p_claim_token
  then
    raise exception using errcode = 'P0001', message = 'delivery_claim_not_found';
  end if;
  if p_provider_message_id is not null and (
    char_length(p_provider_message_id) not between 1 and 128
    or p_provider_message_id !~ '^[A-Za-z0-9_-]+$'
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_provider_message_id';
  end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,64}$' then
    raise exception using errcode = 'P0001', message = 'invalid_error_code';
  end if;

  if p_outcome = 'accepted' then
    if p_provider_message_id is null or btrim(p_provider_message_id) = '' then
      raise exception using errcode = 'P0001', message = 'provider_message_id_required';
    end if;
    next_status := 'accepted';
    update public.review_reminder_deliveries
    set status = next_status, provider_message_id = p_provider_message_id,
      provider_accepted_at = current_timestamp, claim_token = null,
      provider_result_ambiguous_at = null, claimed_at = null,
      claim_expires_at = null, next_attempt_at = null, last_error_code = null
    where id = delivery_row.id;
  elsif p_outcome = 'ambiguous_retry' then
    if delivery_row.attempt_count >= 3
      or current_timestamp >= delivery_row.first_attempt_at + interval '23 hours'
    then
      next_status := 'unknown';
      update public.review_reminder_deliveries
      set status = next_status, terminal_at = current_timestamp,
        provider_result_ambiguous_at = coalesce(
          provider_result_ambiguous_at,
          current_timestamp
        ),
        last_error_code = coalesce(p_error_code, 'ambiguous_retry_window_closed'),
        claim_token = null, claimed_at = null, claim_expires_at = null,
        next_attempt_at = null
      where id = delivery_row.id;
    else
      if p_next_attempt_at is null or p_next_attempt_at <= current_timestamp then
        raise exception using errcode = 'P0001', message = 'invalid_retry_time';
      end if;
      next_status := 'sending';
      update public.review_reminder_deliveries
      set status = next_status, next_attempt_at = p_next_attempt_at,
        provider_result_ambiguous_at = coalesce(
          provider_result_ambiguous_at,
          current_timestamp
        ),
        last_error_code = p_error_code, claim_token = null,
        claimed_at = null, claim_expires_at = null
      where id = delivery_row.id;
    end if;
  elsif p_outcome = 'retry_wait' then
    if delivery_row.attempt_count >= 3
      or current_timestamp >= delivery_row.first_attempt_at + interval '23 hours'
    then
      next_status := case
        when delivery_row.provider_result_ambiguous_at is not null then 'unknown'
        else 'failed'
      end;
      update public.review_reminder_deliveries
      set status = next_status, terminal_at = current_timestamp,
        provider_result_ambiguous_at = delivery_row.provider_result_ambiguous_at,
        last_error_code = coalesce(p_error_code, 'definitive_retry_window_closed'),
        claim_token = null, claimed_at = null, claim_expires_at = null
      where id = delivery_row.id;
    else
      if p_next_attempt_at is null or p_next_attempt_at <= current_timestamp then
        raise exception using errcode = 'P0001', message = 'invalid_retry_time';
      end if;
      next_status := case
        when delivery_row.provider_result_ambiguous_at is not null then 'sending'
        else 'retry_wait'
      end;
      update public.review_reminder_deliveries
      set status = next_status, next_attempt_at = p_next_attempt_at,
        provider_result_ambiguous_at = delivery_row.provider_result_ambiguous_at,
        last_error_code = p_error_code, claim_token = null,
        claimed_at = null, claim_expires_at = null
      where id = delivery_row.id;
    end if;
  elsif p_outcome in ('failed', 'unknown') then
    next_status := case
      when p_outcome = 'failed'
        and delivery_row.provider_result_ambiguous_at is not null then 'unknown'
      else p_outcome
    end;
    update public.review_reminder_deliveries
    set status = next_status, terminal_at = current_timestamp,
      last_error_code = p_error_code, claim_token = null,
      claimed_at = null, claim_expires_at = null
    where id = delivery_row.id;
  else
    raise exception using errcode = 'P0001', message = 'invalid_finalize_outcome';
  end if;

  return jsonb_build_object('delivery_id', p_delivery_id, 'status', next_status);
end;
$function$;

create or replace function public.record_review_email_provider_event(
  p_provider_message_id text,
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  delivery_row public.review_reminder_deliveries%rowtype;
  delivery_owner uuid;
  next_status text;
  incoming_status text;
  incoming_priority integer;
  current_priority integer;
begin
  if p_provider_message_id is null
    or char_length(p_provider_message_id) not between 1 and 128
    or p_provider_message_id !~ '^[A-Za-z0-9_-]+$'
    or p_event_id is null
    or char_length(p_event_id) not between 1 and 256
    or p_event_id !~ '^[A-Za-z0-9_-]+$'
    or p_occurred_at is null
  then
    raise exception using errcode = 'P0001', message = 'invalid_provider_event';
  end if;

  incoming_priority := case p_event_type
    when 'email.sent' then 10
    when 'email.delivery_delayed' then 20
    when 'email.failed' then 30
    when 'email.delivered' then 40
    when 'email.bounced' then 50
    when 'email.complained' then 60
    when 'email.suppressed' then 70
    else null
  end;
  if incoming_priority is null then
    raise exception using errcode = 'P0001', message = 'unsupported_provider_event';
  end if;
  incoming_status := case p_event_type
    when 'email.failed' then 'failed'
    when 'email.delivered' then 'delivered'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.suppressed' then 'suppressed'
    else null
  end;

  select owner_id into delivery_owner from public.review_reminder_deliveries
  where provider_message_id = p_provider_message_id;
  if not found then
    return jsonb_build_object('matched', false);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(delivery_owner::text, 0)
  );
  select * into delivery_row from public.review_reminder_deliveries
  where provider_message_id = p_provider_message_id for update;
  if delivery_row.provider_event_id = p_event_id
  then
    return jsonb_build_object('matched', true, 'status', delivery_row.status);
  end if;

  if delivery_row.provider_event_at is not null
    and p_occurred_at < delivery_row.provider_event_at
  then
    return jsonb_build_object('matched', true, 'status', delivery_row.status);
  end if;

  current_priority := case delivery_row.status
    when 'accepted' then 20
    when 'failed' then 30
    when 'delivered' then 40
    when 'bounced' then 50
    when 'complained' then 60
    when 'suppressed' then 70
    else 0
  end;
  if delivery_row.provider_event_at is not null
    and p_occurred_at = delivery_row.provider_event_at
    and incoming_priority <= current_priority
  then
    return jsonb_build_object('matched', true, 'status', delivery_row.status);
  end if;

  next_status := delivery_row.status;
  if incoming_status is not null and incoming_priority > current_priority then
    next_status := incoming_status;
  end if;

  update public.review_reminder_deliveries
  set status = next_status, provider_event_id = p_event_id,
    provider_event_at = p_occurred_at,
    delivered_at = case when next_status = 'delivered' then p_occurred_at else delivered_at end,
    terminal_at = case
      when next_status = 'delivered' then null
      when next_status in ('bounced','complained','suppressed','failed')
        and next_status <> delivery_row.status then p_occurred_at
      else terminal_at
    end,
    last_error_code = case when next_status = 'delivered' then null else last_error_code end
  where id = delivery_row.id;

  if next_status in ('bounced', 'complained', 'suppressed') then
    update public.owner_setup
    set review_reminder_enabled_at = null,
      review_reminder_unsubscribed_at = current_timestamp
    where owner_id = delivery_row.owner_id;
    update public.review_reminder_deliveries
    set status = 'cancelled', terminal_at = current_timestamp
    where owner_id = delivery_row.owner_id
      and id <> delivery_row.id
      and status in ('pending', 'claimed', 'retry_wait');
  end if;

  return jsonb_build_object('matched', true, 'status', next_status);
end;
$function$;

create or replace function public.purge_review_reminder_deliveries(
  p_now timestamptz,
  p_dry_run boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  retention_cutoff timestamptz;
  candidate_count bigint;
  deleted_count bigint := 0;
begin
  if p_now is null or p_dry_run is null then
    raise exception using errcode = 'P0001', message = 'invalid_retention_request';
  end if;

  retention_cutoff := p_now - interval '90 days';

  select count(*) into candidate_count
  from public.review_reminder_deliveries as delivery
  where case
      when delivery.status = 'accepted' then
        coalesce(delivery.provider_accepted_at, delivery.created_at)
      when delivery.status = 'delivered' then
        coalesce(
          delivery.delivered_at,
          delivery.provider_accepted_at,
          delivery.created_at
        )
      when delivery.status in (
        'bounced', 'complained', 'suppressed', 'cancelled', 'failed', 'unknown'
      ) then coalesce(
        delivery.terminal_at,
        delivery.provider_event_at,
        delivery.provider_accepted_at,
        delivery.created_at
      )
      else delivery.created_at
    end < retention_cutoff
    and not (
      delivery.status in ('claimed', 'sending')
      and delivery.claim_expires_at is not null
      and delivery.claim_expires_at > p_now
    );

  if not p_dry_run then
    delete from public.review_reminder_deliveries as delivery
    where case
        when delivery.status = 'accepted' then
          coalesce(delivery.provider_accepted_at, delivery.created_at)
        when delivery.status = 'delivered' then
          coalesce(
            delivery.delivered_at,
            delivery.provider_accepted_at,
            delivery.created_at
          )
        when delivery.status in (
          'bounced', 'complained', 'suppressed', 'cancelled', 'failed', 'unknown'
        ) then coalesce(
          delivery.terminal_at,
          delivery.provider_event_at,
          delivery.provider_accepted_at,
          delivery.created_at
        )
        else delivery.created_at
      end < retention_cutoff
      and not (
        delivery.status in ('claimed', 'sending')
        and delivery.claim_expires_at is not null
        and delivery.claim_expires_at > p_now
      );
    get diagnostics deleted_count = row_count;
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'retention_days', 90,
    'retention_cutoff', retention_cutoff,
    'candidate_count', candidate_count,
    'deleted_count', deleted_count
  );
end;
$function$;

create or replace function public.unsubscribe_review_email_reminder(
  p_unsubscribe_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  reminder_owner uuid;
begin
  select owner_id into reminder_owner from public.owner_setup
  where review_reminder_unsubscribe_token = p_unsubscribe_token;
  if reminder_owner is null then
    return jsonb_build_object('unsubscribed', true);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(reminder_owner::text, 0)
  );
  update public.owner_setup
  set review_reminder_enabled_at = null,
    review_reminder_unsubscribed_at = current_timestamp
  where owner_id = reminder_owner;
  update public.review_reminder_deliveries
  set status = 'cancelled', terminal_at = current_timestamp,
    claim_token = null, claimed_at = null, claim_expires_at = null
  where owner_id = reminder_owner
    and status in ('pending', 'claimed', 'retry_wait');
  return jsonb_build_object('unsubscribed', true);
end;
$function$;

create or replace function public.cancel_review_reminder_after_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.review_completed_at is null and new.review_completed_at is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.owner_id::text, 0)
    );
    update public.review_reminder_deliveries
    set status = 'cancelled', terminal_at = current_timestamp,
      claim_token = null, claimed_at = null, claim_expires_at = null
    where owner_id = new.owner_id
      and review_year_month = new.year_month
      and status in ('pending', 'claimed', 'retry_wait');
  end if;
  return new;
end;
$function$;

create trigger monthly_milestones_cancel_review_reminder
after update of review_completed_at on public.monthly_milestones
for each row execute function public.cancel_review_reminder_after_review();

revoke all on function public.configure_review_email_reminder(boolean) from public, anon, authenticated;
revoke all on function public.get_review_email_reminder_state() from public, anon, authenticated;

revoke all on function public.claim_review_email_reminders_at(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.claim_review_email_reminders(integer) from public, anon, authenticated;
revoke all on function public.authorize_review_email_reminder_send(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_review_email_reminder(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_review_email_provider_event(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_review_reminder_deliveries(timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.unsubscribe_review_email_reminder(uuid) from public, anon, authenticated;
grant execute on function public.claim_review_email_reminders_at(timestamptz, integer) to service_role;
grant execute on function public.claim_review_email_reminders(integer) to service_role;
grant execute on function public.authorize_review_email_reminder_send(uuid, uuid) to service_role;
grant execute on function public.finalize_review_email_reminder(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.record_review_email_provider_event(text, text, text, timestamptz) to service_role;
grant execute on function public.purge_review_reminder_deliveries(timestamptz, boolean) to service_role;
grant execute on function public.unsubscribe_review_email_reminder(uuid) to service_role;

commit;
