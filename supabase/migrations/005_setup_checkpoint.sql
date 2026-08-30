begin;

alter table public.accounts
  alter column bank drop not null;

create table public.owner_setup (
  owner_id uuid primary key default auth.uid(),
  locale text not null,
  time_zone text not null,
  base_currency text not null,
  savings_account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_setup_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete restrict,
  constraint owner_setup_locale_check
    check (locale in ('en-US', 'en-SG', 'zh-CN')),
  constraint owner_setup_base_currency_check
    check (base_currency in (
      'AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'NZD', 'SGD', 'USD'
    )),
  constraint owner_setup_owner_account_fkey
    foreign key (owner_id, savings_account_id)
    references public.accounts(owner_id, id)
    on delete set null (savings_account_id)
);

create index idx_owner_setup_owner_account
  on public.owner_setup(owner_id, savings_account_id);

create or replace function public.validate_owner_setup_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.time_zone
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_time_zone';
  end if;

  if new.savings_account_id is not null and not exists (
    select 1
    from public.accounts as account
    where account.owner_id = new.owner_id
      and account.id = new.savings_account_id
      and account.purpose = 'savings'
  ) then
    raise exception using errcode = 'P0001', message = 'account_not_savings';
  end if;

  if tg_op = 'UPDATE'
    and old.base_currency is distinct from new.base_currency
    and exists (
      select 1
      from public.accounts as account
      join public.balance_snapshots as snapshot on snapshot.account_id = account.id
      where account.owner_id = old.owner_id
    )
  then
    raise exception using errcode = 'P0001', message = 'base_currency_locked';
  end if;

  return new;
end;
$function$;

create trigger owner_setup_validate
before insert or update on public.owner_setup
for each row execute function public.validate_owner_setup_row();

create trigger owner_setup_updated_at
before update on public.owner_setup
for each row execute function public.update_updated_at();

create or replace function public.protect_linked_savings_account_purpose()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.purpose = 'savings'
    and new.purpose <> 'savings'
    and exists (
      select 1
      from public.owner_setup as setup
      where setup.owner_id = old.owner_id
        and setup.savings_account_id = old.id
    )
  then
    raise exception using errcode = 'P0001', message = 'linked_account_purpose_locked';
  end if;

  return new;
end;
$function$;

create trigger accounts_protect_setup_purpose
before update of purpose on public.accounts
for each row execute function public.protect_linked_savings_account_purpose();

alter table public.owner_setup enable row level security;

revoke all privileges on table public.owner_setup from anon, authenticated;
grant select, insert, update on table public.owner_setup to authenticated;

create policy owner_setup_owner_select
on public.owner_setup for select to authenticated
using ((select auth.uid()) = owner_id);

create policy owner_setup_owner_insert
on public.owner_setup for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy owner_setup_owner_update
on public.owner_setup for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create or replace function public.save_owner_setup_step(
  p_step text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  setup_owner uuid;
  setup_row public.owner_setup%rowtype;
  setup_account public.accounts%rowtype;
  requested_locale text;
  requested_time_zone text;
  requested_currency text;
  requested_mode text;
  requested_account_id uuid;
  requested_name text;
  requested_institution text;
  requested_balance numeric;
  requested_date date;
  existing_balance numeric;
  latest_balance jsonb;
  account_payload jsonb;
begin
  setup_owner := auth.uid();
  if setup_owner is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(setup_owner::text, 0)
  );

  p_payload := coalesce(p_payload, '{}'::jsonb);

  case p_step
    when 'preferences' then
      requested_locale := p_payload ->> 'locale';
      requested_time_zone := p_payload ->> 'time_zone';
      requested_currency := upper(p_payload ->> 'base_currency');

      if requested_locale is null
        or requested_locale not in ('en-US', 'en-SG', 'zh-CN')
      then
        raise exception using errcode = 'P0001', message = 'invalid_locale';
      end if;

      if requested_time_zone is null or not exists (
        select 1
        from pg_catalog.pg_timezone_names
        where name = requested_time_zone
      ) then
        raise exception using errcode = 'P0001', message = 'invalid_time_zone';
      end if;

      if requested_currency is null or requested_currency not in (
        'AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'NZD', 'SGD', 'USD'
      ) then
        raise exception using errcode = 'P0001', message = 'unsupported_base_currency';
      end if;

      select * into setup_row
      from public.owner_setup
      where owner_id = setup_owner
      for update;

      if found
        and setup_row.base_currency is distinct from requested_currency
        and exists (
          select 1
          from public.accounts as account
          join public.balance_snapshots as snapshot on snapshot.account_id = account.id
          where account.owner_id = setup_owner
        )
      then
        raise exception using errcode = 'P0001', message = 'base_currency_locked';
      end if;

      insert into public.owner_setup (
        owner_id,
        locale,
        time_zone,
        base_currency
      )
      values (
        setup_owner,
        requested_locale,
        requested_time_zone,
        requested_currency
      )
      on conflict (owner_id) do update
      set
        locale = excluded.locale,
        time_zone = excluded.time_zone,
        base_currency = excluded.base_currency;

    when 'savings_account' then
      select * into setup_row
      from public.owner_setup
      where owner_id = setup_owner
      for update;

      if not found then
        raise exception using errcode = 'P0001', message = 'preferences_required';
      end if;

      requested_mode := p_payload ->> 'mode';

      if requested_mode = 'create' then
        if setup_row.savings_account_id is not null then
          select * into setup_account
          from public.accounts
          where owner_id = setup_owner
            and id = setup_row.savings_account_id
            and purpose = 'savings';
        end if;

        if setup_account.id is null then
          requested_name := btrim(p_payload ->> 'name');
          requested_institution := nullif(btrim(p_payload ->> 'institution'), '');

          if requested_name is null
            or requested_name = ''
            or char_length(requested_name) > 100
          then
            raise exception using errcode = 'P0001', message = 'invalid_account_name';
          end if;

          if requested_institution is not null
            and char_length(requested_institution) > 100
          then
            raise exception using errcode = 'P0001', message = 'invalid_institution';
          end if;

          insert into public.accounts (
            owner_id,
            name,
            bank,
            purpose,
            icon,
            sort_order
          )
          values (
            setup_owner,
            requested_name,
            requested_institution,
            'savings',
            '🏦',
            (
              select coalesce(max(account.sort_order), -1) + 1
              from public.accounts as account
              where account.owner_id = setup_owner
            )
          )
          returning * into setup_account;
        end if;

      elsif requested_mode = 'attach' then
        begin
          requested_account_id := (p_payload ->> 'savings_account_id')::uuid;
        exception when invalid_text_representation then
          raise exception using errcode = 'P0001', message = 'account_not_found';
        end;

        select * into setup_account
        from public.accounts
        where owner_id = setup_owner
          and id = requested_account_id
          and purpose = 'savings';

        if not found then
          raise exception using errcode = 'P0001', message = 'account_not_found';
        end if;

      else
        raise exception using errcode = 'P0001', message = 'invalid_account_mode';
      end if;

      update public.owner_setup
      set savings_account_id = setup_account.id
      where owner_id = setup_owner;

    when 'initial_balance' then
      select * into setup_row
      from public.owner_setup
      where owner_id = setup_owner
      for update;

      if not found then
        raise exception using errcode = 'P0001', message = 'preferences_required';
      end if;

      if setup_row.savings_account_id is null then
        raise exception using errcode = 'P0001', message = 'savings_account_required';
      end if;

      select * into setup_account
      from public.accounts
      where owner_id = setup_owner
        and id = setup_row.savings_account_id
        and purpose = 'savings';

      if not found then
        raise exception using errcode = 'P0001', message = 'savings_account_required';
      end if;

      begin
        requested_balance := (p_payload ->> 'balance')::numeric;
      exception when invalid_text_representation then
        raise exception using errcode = 'P0001', message = 'invalid_balance';
      end;

      if requested_balance is null
        or requested_balance::text = 'NaN'
        or requested_balance < 0
        or requested_balance > 9999999999.99
        or scale(requested_balance) > 2
      then
        raise exception using errcode = 'P0001', message = 'invalid_balance';
      end if;

      begin
        requested_date := (p_payload ->> 'recorded_at')::date;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception using errcode = 'P0001', message = 'invalid_recorded_at';
      end;

      if requested_date is null
        or requested_date > (current_timestamp at time zone setup_row.time_zone)::date
      then
        raise exception using errcode = 'P0001', message = 'invalid_recorded_at';
      end if;

      select balance into existing_balance
      from public.balance_snapshots
      where account_id = setup_account.id
        and recorded_at = requested_date;

      if found then
        if existing_balance is distinct from requested_balance then
          raise exception using errcode = 'P0001', message = 'initial_balance_conflict';
        end if;
      else
        insert into public.balance_snapshots (
          account_id,
          recorded_at,
          balance
        )
        values (
          setup_account.id,
          requested_date,
          requested_balance
        );
      end if;

    else
      raise exception using errcode = 'P0001', message = 'invalid_setup_step';
  end case;

  select * into setup_row
  from public.owner_setup
  where owner_id = setup_owner;

  if setup_row.savings_account_id is not null then
    select * into setup_account
    from public.accounts
    where owner_id = setup_owner
      and id = setup_row.savings_account_id
      and purpose = 'savings';
  end if;

  if setup_account.id is not null then
    account_payload := pg_catalog.jsonb_build_object(
      'id', setup_account.id,
      'name', setup_account.name,
      'institution', setup_account.bank,
      'purpose', setup_account.purpose
    );

    select pg_catalog.jsonb_build_object(
      'balance', snapshot.balance,
      'recorded_at', snapshot.recorded_at
    )
    into latest_balance
    from public.balance_snapshots as snapshot
    where snapshot.account_id = setup_account.id
    order by snapshot.recorded_at desc, snapshot.created_at desc
    limit 1;
  end if;

  return pg_catalog.jsonb_build_object(
    'locale', setup_row.locale,
    'time_zone', setup_row.time_zone,
    'base_currency', setup_row.base_currency,
    'savings_account', account_payload,
    'initial_balance', latest_balance
  );
end;
$function$;

revoke all on function public.save_owner_setup_step(text, jsonb) from public, anon;
grant execute on function public.save_owner_setup_step(text, jsonb) to authenticated;

commit;
