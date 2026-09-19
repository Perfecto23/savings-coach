-- Keep the owner-local month and plan target stable after Plan Activation.
create or replace function public.protect_activated_setup_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.plan_activated_at is not null
    and (
      old.time_zone is distinct from new.time_zone
      or old.savings_account_id is distinct from new.savings_account_id
    )
  then
    raise exception using errcode = 'P0001', message = 'activated_setup_locked';
  end if;

  return new;
end;
$function$;

drop trigger if exists owner_setup_lock_activated_fields on public.owner_setup;
create trigger owner_setup_lock_activated_fields
before update of time_zone, savings_account_id on public.owner_setup
for each row execute function public.protect_activated_setup_fields();
