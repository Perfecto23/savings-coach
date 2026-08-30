#!/usr/bin/env bash

set -euo pipefail

PROGRESS_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PROGRESS_OWNER="00000000-0000-4000-8000-00000000007c"
PROGRESS_ACCOUNT_ONE="10000000-0000-4000-8000-00000000007c"
PROGRESS_ACCOUNT_TWO="11000000-0000-4000-8000-00000000007c"
PROGRESS_RULE="20000000-0000-4000-8000-00000000007c"
PROGRESS_OTHER_OWNER="00000000-0000-4000-8000-00000000007e"
PROGRESS_OTHER_ACCOUNT="10000000-0000-4000-8000-00000000007e"
PROGRESS_TMP_DIR="$(mktemp -d)"

cleanup() {
  set +e
  rm -r -- "$PROGRESS_TMP_DIR"
  pnpm exec supabase db reset --no-seed >/dev/null 2>&1
}

trap cleanup EXIT

run_sql() {
  psql "$PROGRESS_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

run_as_identity() {
  local owner_id="$1"
  local sql="$2"
  psql "$PROGRESS_DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
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
  run_as_identity "$PROGRESS_OWNER" "$1"
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
  run_as_owner "$first_sql" >"$PROGRESS_TMP_DIR/first.log" 2>&1 &
  local first_pid=$!
  run_as_owner "$second_sql" >"$PROGRESS_TMP_DIR/second.log" 2>&1 &
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
      '$PROGRESS_OWNER', 'authenticated', 'authenticated',
      'progress-concurrency@example.invalid', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      '$PROGRESS_OTHER_OWNER', 'authenticated', 'authenticated',
      'progress-concurrency-other@example.invalid', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values
    ('$PROGRESS_ACCOUNT_ONE', '$PROGRESS_OWNER', 'Concurrent Primary', null, 'savings'),
    ('$PROGRESS_ACCOUNT_TWO', '$PROGRESS_OWNER', 'Concurrent Secondary', null, 'savings'),
    ('$PROGRESS_OTHER_ACCOUNT', '$PROGRESS_OTHER_OWNER', 'Other Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id
  ) values
    ('$PROGRESS_OWNER', 'en-SG', 'Asia/Singapore', 'SGD', '$PROGRESS_ACCOUNT_ONE'),
    ('$PROGRESS_OTHER_OWNER', 'en-US', 'America/New_York', 'USD', '$PROGRESS_OTHER_ACCOUNT');
  insert into public.balance_snapshots (account_id, recorded_at, balance)
  values
    (
      '$PROGRESS_ACCOUNT_ONE',
      (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month')::date,
      100
    ),
    (
      '$PROGRESS_ACCOUNT_TWO',
      (date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month')::date,
      50
    );
"

run_as_owner "
  select public.save_plan_rule(
    '{
      \"rule_id\":\"$PROGRESS_RULE\",
      \"name\":\"Concurrent Progress Rule\",
      \"amount\":\"100.00\",
      \"due_day\":15,
      \"source_account_id\":null,
      \"target_account_id\":\"$PROGRESS_ACCOUNT_ONE\"
    }'::jsonb
  );
  select public.activate_savings_plan();
" >/dev/null

PROGRESS_LOCAL_DATE="$(run_sql "select (current_timestamp at time zone 'Asia/Singapore')::date;")"
PROGRESS_OTHER_LOCAL_DATE="$(run_sql "select (current_timestamp at time zone 'America/New_York')::date;")"

run_pair \
  "two full Balance Observation payloads serialize" \
  "select public.save_balance_observations('$PROGRESS_LOCAL_DATE', '[{\"account_id\":\"$PROGRESS_ACCOUNT_ONE\",\"balance\":\"10.00\"},{\"account_id\":\"$PROGRESS_ACCOUNT_TWO\",\"balance\":\"20.00\"}]'::jsonb);" \
  "select public.save_balance_observations('$PROGRESS_LOCAL_DATE', '[{\"account_id\":\"$PROGRESS_ACCOUNT_ONE\",\"balance\":\"30.00\"},{\"account_id\":\"$PROGRESS_ACCOUNT_TWO\",\"balance\":\"40.00\"}]'::jsonb);"

assert_value "concurrent writes leave one row per account-date" "2" \
  "select count(*) from public.balance_snapshots where account_id in ('$PROGRESS_ACCOUNT_ONE', '$PROGRESS_ACCOUNT_TWO') and recorded_at = '$PROGRESS_LOCAL_DATE';"
assert_value "concurrent writes leave one complete payload" "1" \
  "select case when array_agg(balance order by account_id) in (array[10.00::numeric,20.00::numeric], array[30.00::numeric,40.00::numeric]) then 1 else 0 end from public.balance_snapshots where account_id in ('$PROGRESS_ACCOUNT_ONE', '$PROGRESS_ACCOUNT_TWO') and recorded_at = '$PROGRESS_LOCAL_DATE';"
assert_value "Progress matches the final serialized payload" "1" \
  "select case when milestone.actual_total_savings = snapshot.total and milestone.actual_savings = snapshot.total - 150 and milestone.planned_total_savings = 250 and milestone.status = 'pending' then 1 else 0 end from public.monthly_milestones as milestone cross join (select sum(balance) as total from public.balance_snapshots where account_id in ('$PROGRESS_ACCOUNT_ONE', '$PROGRESS_ACCOUNT_TWO') and recorded_at = '$PROGRESS_LOCAL_DATE') as snapshot where milestone.owner_id = '$PROGRESS_OWNER' and milestone.is_plan_path and milestone.year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');"

run_pair \
  "same-date delete and replacement save serialize" \
  "select public.delete_balance_observations('$PROGRESS_LOCAL_DATE');" \
  "select public.save_balance_observations('$PROGRESS_LOCAL_DATE', '[{\"account_id\":\"$PROGRESS_ACCOUNT_ONE\",\"balance\":\"50.00\"},{\"account_id\":\"$PROGRESS_ACCOUNT_TWO\",\"balance\":\"60.00\"}]'::jsonb);"

assert_value "delete/save race leaves no partial observed date" "1" \
  "select case when count(*) in (0, 2) then 1 else 0 end from public.balance_snapshots where account_id in ('$PROGRESS_ACCOUNT_ONE', '$PROGRESS_ACCOUNT_TWO') and recorded_at = '$PROGRESS_LOCAL_DATE';"
assert_value "delete/save race leaves Progress consistent" "1" \
  "select case when snapshot.row_count = 0 and milestone.actual_savings is null and milestone.actual_total_savings is null then 1 when snapshot.row_count = 2 and snapshot.total = 110 and milestone.actual_savings = -40 and milestone.actual_total_savings = 110 then 1 else 0 end from public.monthly_milestones as milestone cross join (select count(*) as row_count, sum(balance) as total from public.balance_snapshots where account_id in ('$PROGRESS_ACCOUNT_ONE', '$PROGRESS_ACCOUNT_TWO') and recorded_at = '$PROGRESS_LOCAL_DATE') as snapshot where milestone.owner_id = '$PROGRESS_OWNER' and milestone.is_plan_path and milestone.year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');"

set +e
run_as_identity "$PROGRESS_OTHER_OWNER" \
  "select public.save_balance_observations('$PROGRESS_OTHER_LOCAL_DATE', '[{\"account_id\":\"$PROGRESS_ACCOUNT_ONE\",\"balance\":\"999.00\"}]'::jsonb);" \
  >"$PROGRESS_TMP_DIR/cross-owner.log" 2>&1
PROGRESS_CROSS_OWNER_STATUS=$?
set -e

if [[ $PROGRESS_CROSS_OWNER_STATUS -eq 0 ]]; then
  printf 'FAIL: cross-owner Balance Observation falsely succeeded\n' >&2
  exit 1
fi
if ! grep -q 'account_not_found' "$PROGRESS_TMP_DIR/cross-owner.log"; then
  printf 'FAIL: cross-owner failure did not return account_not_found\n' >&2
  exit 1
fi
printf 'PASS: cross-owner Balance Observation has no false success\n'

printf 'PASS: Trustworthy Progress concurrency invariants\n'
