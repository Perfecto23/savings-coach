#!/usr/bin/env bash

set -euo pipefail

HOME_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
HOME_OWNER="00000000-0000-4000-8000-00000000006c"
HOME_ACCOUNT="10000000-0000-4000-8000-00000000006c"
HOME_RULE_ONE="20000000-0000-4000-8000-00000000006c"
HOME_RULE_TWO="20000000-0000-4000-8000-00000000006d"
HOME_OTHER_OWNER="00000000-0000-4000-8000-00000000006e"
HOME_OTHER_ACCOUNT="10000000-0000-4000-8000-00000000006e"
HOME_TMP_DIR="$(mktemp -d)"

cleanup() {
  set +e
  rm -r -- "$HOME_TMP_DIR"
  pnpm exec supabase db reset --no-seed >/dev/null 2>&1
}

trap cleanup EXIT

run_sql() {
  psql "$HOME_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

run_as_identity() {
  local owner_id="$1"
  local sql="$2"
  psql "$HOME_DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$owner_id';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"$owner_id","role":"authenticated"}';
select pg_sleep(0.25);
$sql
commit;
SQL
}

run_as_owner() {
  run_as_identity "$HOME_OWNER" "$1"
}

assert_value() {
  local description="$1"
  local expected="$2"
  local query="$3"
  local actual
  actual="$(run_sql "$query")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL: %s (expected %s, got %s)\n' \
      "$description" "$expected" "$actual" >&2
    exit 1
  fi
}

run_pair() {
  local description="$1"
  local first_sql="$2"
  local second_sql="$3"
  local first_status
  local second_status

  set +e
  run_as_owner "$first_sql" >"$HOME_TMP_DIR/first.log" 2>&1 &
  local first_pid=$!
  run_as_owner "$second_sql" >"$HOME_TMP_DIR/second.log" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  first_status=$?
  wait "$second_pid"
  second_status=$?
  set -e

  if [[ $first_status -ne 0 || $second_status -ne 0 ]]; then
    printf 'FAIL: %s (session statuses %s/%s)\n' \
      "$description" "$first_status" "$second_status" >&2
    exit 1
  fi
  printf 'PASS: %s\n' "$description"
}

pnpm exec supabase db reset --no-seed >/dev/null

run_sql "
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (
      '$HOME_OWNER', 'authenticated', 'authenticated',
      'home-concurrency@example.invalid', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      '$HOME_OTHER_OWNER', 'authenticated', 'authenticated',
      'home-concurrency-other@example.invalid', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values
    ('$HOME_ACCOUNT', '$HOME_OWNER', 'Home Concurrent Savings', null, 'savings'),
    ('$HOME_OTHER_ACCOUNT', '$HOME_OTHER_OWNER', 'Other Home Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id
  ) values
    ('$HOME_OWNER', 'en-SG', 'Asia/Singapore', 'SGD', '$HOME_ACCOUNT'),
    ('$HOME_OTHER_OWNER', 'en-US', 'America/New_York', 'USD', '$HOME_OTHER_ACCOUNT');
  insert into public.balance_snapshots (account_id, recorded_at, balance)
  values
    (
      '$HOME_ACCOUNT',
      (current_timestamp at time zone 'Asia/Singapore')::date,
      1000
    ),
    (
      '$HOME_OTHER_ACCOUNT',
      (current_timestamp at time zone 'America/New_York')::date,
      2000
    );
"

run_as_owner "
  select public.save_plan_rule(
    '{
      \"rule_id\":\"$HOME_RULE_ONE\",
      \"name\":\"First concurrent action\",
      \"amount\":\"100.00\",
      \"due_day\":10,
      \"source_account_id\":null,
      \"target_account_id\":\"$HOME_ACCOUNT\"
    }'::jsonb
  );
  select public.save_plan_rule(
    '{
      \"rule_id\":\"$HOME_RULE_TWO\",
      \"name\":\"Second concurrent action\",
      \"amount\":\"200.00\",
      \"due_day\":20,
      \"source_account_id\":null,
      \"target_account_id\":\"$HOME_ACCOUNT\"
    }'::jsonb
  );
  select public.activate_savings_plan();
" >/dev/null

HOME_ACTION_ONE="$(run_sql "
  select id
  from public.sop_records
  where owner_id = '$HOME_OWNER'
    and template_id = '$HOME_RULE_ONE'
    and is_monthly_action;
")"
HOME_ACTION_TWO="$(run_sql "
  select id
  from public.sop_records
  where owner_id = '$HOME_OWNER'
    and template_id = '$HOME_RULE_TWO'
    and is_monthly_action;
")"

run_pair \
  "two Monthly Actions complete concurrently" \
  "select public.update_monthly_action('$HOME_ACTION_ONE', '{\"completed\":true}'::jsonb);" \
  "select public.update_monthly_action('$HOME_ACTION_TWO', '{\"completed\":true}'::jsonb);"

HOME_ACTIVATED_NOW_COUNT="$(
  grep -h '"behavior_activated_now": true' \
    "$HOME_TMP_DIR/first.log" "$HOME_TMP_DIR/second.log" | wc -l | tr -d ' '
)"
if [[ "$HOME_ACTIVATED_NOW_COUNT" != "1" ]]; then
  printf 'FAIL: concurrent completion emitted Behavior Activation %s times\n' \
    "$HOME_ACTIVATED_NOW_COUNT" >&2
  exit 1
fi

assert_value "one Behavior Activation timestamp exists" "1" \
  "select count(*) from public.owner_setup where owner_id = '$HOME_OWNER' and behavior_activated_at is not null;"
assert_value "both Monthly Actions are complete" "2" \
  "select count(*) from public.sop_records where owner_id = '$HOME_OWNER' and is_monthly_action and completed;"
assert_value "concurrent completion makes the current Plan Path on track" "on_track" \
  "select status from public.monthly_milestones where owner_id = '$HOME_OWNER' and is_plan_path and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');"
assert_value "concurrent completion preserves observation-authoritative Net Worth fields" "1" \
  "select case when actual_savings is null and actual_total_savings = 1000 then 1 else 0 end from public.monthly_milestones where owner_id = '$HOME_OWNER' and is_plan_path and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');"

HOME_FIRST_BEHAVIOR_AT="$(run_sql "
  select behavior_activated_at
  from public.owner_setup
  where owner_id = '$HOME_OWNER';
")"

run_pair \
  "reopen and completion of one Monthly Action serialize" \
  "select public.update_monthly_action('$HOME_ACTION_ONE', '{\"completed\":false}'::jsonb);" \
  "select public.update_monthly_action('$HOME_ACTION_ONE', '{\"completed\":true}'::jsonb);"

assert_value "serialized retries preserve first Behavior Activation" \
  "$HOME_FIRST_BEHAVIOR_AT" \
  "select behavior_activated_at from public.owner_setup where owner_id = '$HOME_OWNER';"
assert_value "Plan Path status matches final Monthly Action states" "1" \
  "select case when path.status = case when action.all_completed then 'on_track' else 'pending' end then 1 else 0 end from public.monthly_milestones as path cross join (select bool_and(completed) as all_completed from public.sop_records where owner_id = '$HOME_OWNER' and is_monthly_action and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM')) as action where path.owner_id = '$HOME_OWNER' and path.is_plan_path and path.year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');"

set +e
run_as_identity "$HOME_OTHER_OWNER" \
  "select public.update_monthly_action('$HOME_ACTION_ONE', '{\"completed\":true}'::jsonb);" \
  >"$HOME_TMP_DIR/cross-owner.log" 2>&1
HOME_CROSS_OWNER_STATUS=$?
set -e

if [[ $HOME_CROSS_OWNER_STATUS -eq 0 ]]; then
  printf 'FAIL: cross-owner Monthly Action update falsely succeeded\n' >&2
  exit 1
fi
if ! grep -q 'monthly_action_not_found' "$HOME_TMP_DIR/cross-owner.log"; then
  printf 'FAIL: cross-owner failure did not return monthly_action_not_found\n' >&2
  exit 1
fi
printf 'PASS: cross-owner Monthly Action update has no false success\n'

printf 'PASS: Monthly execution concurrency invariants\n'
