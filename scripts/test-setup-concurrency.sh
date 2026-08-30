#!/usr/bin/env bash

set -euo pipefail

SC_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SC_USER_ID="00000000-0000-4000-8000-00000000004c"
SC_TMP_DIR="$(mktemp -d)"

restore_current_schema() {
  set +e
  rm -r -- "$SC_TMP_DIR"
  pnpm exec supabase db reset --no-seed >/dev/null 2>&1
}

trap restore_current_schema EXIT

run_sql() {
  psql "$SC_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

assert_value() {
  local description="$1"
  local expected="$2"
  local query="$3"
  local actual
  actual="$(run_sql "$query")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL: %s (expected %s, got %s)\n' "$description" "$expected" "$actual" >&2
    exit 1
  fi
}

run_authenticated_rpc() {
  local step="$1"
  local payload="$2"

  psql "$SC_DB_URL" -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -qAt <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$SC_USER_ID';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"$SC_USER_ID","role":"authenticated"}';
select pg_sleep(0.25);
select public.save_owner_setup_step('$step', '$payload'::jsonb);
commit;
SQL
}

run_success_pair() {
  local description="$1"
  local step="$2"
  local payload="$3"
  local first_status
  local second_status

  set +e
  run_authenticated_rpc "$step" "$payload" >"$SC_TMP_DIR/first.log" 2>&1 &
  local first_pid=$!
  run_authenticated_rpc "$step" "$payload" >"$SC_TMP_DIR/second.log" 2>&1 &
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

run_locked_pair() {
  local description="$1"
  local step="$2"
  local first_payload="$3"
  local second_payload="$4"
  local first_status
  local second_status

  set +e
  run_authenticated_rpc "$step" "$first_payload" >"$SC_TMP_DIR/conflict-first.log" 2>&1 &
  local first_pid=$!
  run_authenticated_rpc "$step" "$second_payload" >"$SC_TMP_DIR/conflict-second.log" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  first_status=$?
  wait "$second_pid"
  second_status=$?
  set -e

  if [[ $first_status -eq 0 || $second_status -eq 0 ]]; then
    printf 'FAIL: %s (expected two locked failures, got %s/%s)\n' \
      "$description" "$first_status" "$second_status" >&2
    exit 1
  fi

  if ! grep -q 'initial_balance_locked' "$SC_TMP_DIR/conflict-first.log" \
    || ! grep -q 'initial_balance_locked' "$SC_TMP_DIR/conflict-second.log"
  then
    printf 'FAIL: %s (sessions did not report initial_balance_locked)\n' \
      "$description" >&2
    exit 1
  fi
  printf 'PASS: %s\n' "$description"
}

pnpm exec supabase db reset --no-seed >/dev/null

run_sql "
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '$SC_USER_ID', 'authenticated', 'authenticated',
    'setup-concurrency@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
"

SC_LOCAL_DATE="$(run_sql "select (current_timestamp at time zone 'Asia/Singapore')::date;")"
SC_CONFLICT_DATE="$(run_sql "select ((current_timestamp at time zone 'Asia/Singapore')::date - 1)::date;")"

run_success_pair \
  "concurrent preferences create one checkpoint" \
  "preferences" \
  '{"locale":"en-SG","time_zone":"Asia/Singapore","base_currency":"SGD"}'

assert_value "one owner_setup row remains" "1" \
  "select count(*) from public.owner_setup where owner_id = '$SC_USER_ID';"
assert_value "preferences are intact" "en-SG|Asia/Singapore|SGD" \
  "select concat_ws('|', locale, time_zone, base_currency) from public.owner_setup where owner_id = '$SC_USER_ID';"

run_success_pair \
  "concurrent account creation links one savings account" \
  "savings_account" \
  '{"mode":"create","name":"Concurrent Savings","institution":null}'

assert_value "one savings account is created" "1" \
  "select count(*) from public.accounts where owner_id = '$SC_USER_ID' and purpose = 'savings';"
assert_value "one linked savings account is restored" "1" \
  "select count(*) from public.owner_setup as setup join public.accounts as account on account.owner_id = setup.owner_id and account.id = setup.savings_account_id and account.purpose = 'savings' where setup.owner_id = '$SC_USER_ID';"

run_success_pair \
  "concurrent identical balances are idempotent" \
  "initial_balance" \
  "{\"balance\":\"1234.56\",\"recorded_at\":\"$SC_LOCAL_DATE\"}"

assert_value "identical balance writes create one snapshot" "1" \
  "select count(*) from public.owner_setup as setup join public.balance_snapshots as snapshot on snapshot.account_id = setup.savings_account_id where setup.owner_id = '$SC_USER_ID' and snapshot.recorded_at = '$SC_LOCAL_DATE';"
assert_value "identical balance value is preserved" "1234.56" \
  "select snapshot.balance from public.owner_setup as setup join public.balance_snapshots as snapshot on snapshot.account_id = setup.savings_account_id where setup.owner_id = '$SC_USER_ID' and snapshot.recorded_at = '$SC_LOCAL_DATE';"

run_locked_pair \
  "concurrent second-date balances are both locked" \
  "initial_balance" \
  "{\"balance\":\"10.00\",\"recorded_at\":\"$SC_CONFLICT_DATE\"}" \
  "{\"balance\":\"20.00\",\"recorded_at\":\"$SC_CONFLICT_DATE\"}"

assert_value "locked second-date writes create no snapshot" "0" \
  "select count(*) from public.owner_setup as setup join public.balance_snapshots as snapshot on snapshot.account_id = setup.savings_account_id where setup.owner_id = '$SC_USER_ID' and snapshot.recorded_at = '$SC_CONFLICT_DATE';"
assert_value "locked retries preserve the first observation" "1234.56" \
  "select snapshot.balance from public.owner_setup as setup join public.balance_snapshots as snapshot on snapshot.account_id = setup.savings_account_id where setup.owner_id = '$SC_USER_ID' and snapshot.recorded_at = '$SC_LOCAL_DATE';"

printf 'PASS: Setup concurrency invariants\n'
