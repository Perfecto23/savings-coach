#!/usr/bin/env bash

set -euo pipefail

PLAN_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PLAN_OWNER="00000000-0000-4000-8000-00000000005c"
PLAN_ACCOUNT="10000000-0000-4000-8000-00000000005c"
PLAN_RULE="20000000-0000-4000-8000-00000000005c"
PLAN_OTHER_OWNER="00000000-0000-4000-8000-00000000005e"
PLAN_OTHER_ACCOUNT="10000000-0000-4000-8000-00000000005e"
PLAN_SHARED_RULE="20000000-0000-4000-8000-00000000005e"
PLAN_LEGACY_OWNER="00000000-0000-4000-8000-00000000005d"
PLAN_MIGRATION="supabase/migrations/006_savings_plan_activation.sql"
PLAN_TMP_DIR="$(mktemp -d)"

cleanup() {
  set +e
  rm -r -- "$PLAN_TMP_DIR"
  pnpm exec supabase db reset --no-seed >/dev/null 2>&1
}

trap cleanup EXIT

run_sql() {
  psql "$PLAN_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

run_as_identity() {
  local owner_id="$1"
  local sql="$2"
  psql "$PLAN_DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
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
  run_as_identity "$PLAN_OWNER" "$1"
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

run_pair() {
  local description="$1"
  local first_sql="$2"
  local second_sql="$3"
  local first_status
  local second_status

  set +e
  run_as_owner "$first_sql" >"$PLAN_TMP_DIR/first.log" 2>&1 &
  local first_pid=$!
  run_as_owner "$second_sql" >"$PLAN_TMP_DIR/second.log" 2>&1 &
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

run_cross_owner_same_uuid_pair() {
  local first_status
  local second_status

  set +e
  run_as_identity "$PLAN_OWNER" \
    "select public.save_plan_rule('{\"rule_id\":\"$PLAN_SHARED_RULE\",\"name\":\"Owner C shared UUID\",\"amount\":\"30.00\",\"due_day\":10,\"source_account_id\":null,\"target_account_id\":\"$PLAN_ACCOUNT\"}'::jsonb);" \
    >"$PLAN_TMP_DIR/shared-first.log" 2>&1 &
  local first_pid=$!
  run_as_identity "$PLAN_OTHER_OWNER" \
    "select public.save_plan_rule('{\"rule_id\":\"$PLAN_SHARED_RULE\",\"name\":\"Owner E shared UUID\",\"amount\":\"40.00\",\"due_day\":11,\"source_account_id\":null,\"target_account_id\":\"$PLAN_OTHER_ACCOUNT\"}'::jsonb);" \
    >"$PLAN_TMP_DIR/shared-second.log" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  first_status=$?
  wait "$second_pid"
  second_status=$?
  set -e

  if ! { [[ $first_status -eq 0 && $second_status -ne 0 ]] \
    || [[ $first_status -ne 0 && $second_status -eq 0 ]]; }
  then
    printf 'FAIL: cross-owner same UUID expected one success, got %s/%s\n' \
      "$first_status" "$second_status" >&2
    exit 1
  fi

  local failed_log="$PLAN_TMP_DIR/shared-first.log"
  if [[ $first_status -eq 0 ]]; then
    failed_log="$PLAN_TMP_DIR/shared-second.log"
  fi
  if ! grep -q 'rule_not_found' "$failed_log"; then
    printf 'FAIL: cross-owner same UUID loser did not receive rule_not_found\n' >&2
    exit 1
  fi
  printf 'PASS: cross-owner same UUID has no false success\n'
}

pnpm exec supabase db reset --version 005 --no-seed >/dev/null

run_sql "
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '$PLAN_LEGACY_OWNER', 'authenticated', 'authenticated',
    'plan-legacy@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values ('10000000-0000-4000-8000-00000000005d', '$PLAN_LEGACY_OWNER', 'Legacy Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id
  ) values (
    '$PLAN_LEGACY_OWNER', 'en-SG', 'Asia/Singapore', 'SGD',
    '10000000-0000-4000-8000-00000000005d'
  );
  insert into public.sop_templates (
    id, owner_id, step_key, step_label, due_day,
    to_account_id, default_amount, is_active
  ) values (
    '20000000-0000-4000-8000-00000000005d', '$PLAN_LEGACY_OWNER',
    'legacy_rule', 'Legacy Rule', 31,
    '10000000-0000-4000-8000-00000000005d', 75, true
  );
  insert into public.sop_records (
    id, owner_id, year_month, template_id, step_key, step_label,
    due_day, completed, completed_at, amount,
    counts_toward_milestone, milestone_amount
  ) values (
    '80000000-0000-4000-8000-00000000005d', '$PLAN_LEGACY_OWNER',
    '2027-02', '20000000-0000-4000-8000-00000000005d',
    'legacy_rule', 'Legacy Rule', 31, true, now(), 75, true, 75
  );
"

psql "$PLAN_DB_URL" -v ON_ERROR_STOP=1 -q -f "$PLAN_MIGRATION" >/dev/null
assert_value "compatible legacy template is marked as a Plan Rule" "1" \
  "select count(*) from public.sop_templates where id = '20000000-0000-4000-8000-00000000005d' and is_plan_rule;"
assert_value "compatible legacy record becomes a frozen Monthly Action" "1" \
  "select count(*) from public.sop_records where id = '80000000-0000-4000-8000-00000000005d' and is_monthly_action and completed and rule_amount = 75 and scheduled_for = '2027-02-28';"
assert_value "legacy projection does not fake Plan activation" "0" \
  "select count(*) from public.owner_setup where owner_id = '$PLAN_LEGACY_OWNER' and plan_activated_at is not null;"
printf 'PASS: compatible legacy projection\n'

pnpm exec supabase db reset --no-seed >/dev/null

run_sql "
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '$PLAN_OWNER', 'authenticated', 'authenticated',
    'plan-concurrency@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values ('$PLAN_ACCOUNT', '$PLAN_OWNER', 'Concurrent Plan Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id
  ) values (
    '$PLAN_OWNER', 'en-SG', 'Asia/Singapore', 'SGD', '$PLAN_ACCOUNT'
  );
  insert into public.balance_snapshots (account_id, recorded_at, balance)
  values (
    '$PLAN_ACCOUNT',
    (current_timestamp at time zone 'Asia/Singapore')::date,
    1000
  );
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '$PLAN_OTHER_OWNER', 'authenticated', 'authenticated',
    'plan-concurrency-other@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values ('$PLAN_OTHER_ACCOUNT', '$PLAN_OTHER_OWNER', 'Other Plan Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id
  ) values (
    '$PLAN_OTHER_OWNER', 'en-US', 'America/New_York', 'USD', '$PLAN_OTHER_ACCOUNT'
  );
  insert into public.balance_snapshots (account_id, recorded_at, balance)
  values (
    '$PLAN_OTHER_ACCOUNT',
    (current_timestamp at time zone 'America/New_York')::date,
    2000
  );
"

run_as_owner "
  select public.save_plan_rule(
    '{
      \"rule_id\":\"$PLAN_RULE\",
      \"name\":\"Concurrent Rule\",
      \"amount\":\"100.00\",
      \"due_day\":15,
      \"source_account_id\":null,
      \"target_account_id\":\"$PLAN_ACCOUNT\"
    }'::jsonb
  );
" >/dev/null

run_pair \
  "two activation sessions converge" \
  "select public.activate_savings_plan();" \
  "select public.activate_savings_plan();"

assert_value "one activation timestamp exists" "1" \
  "select count(*) from public.owner_setup where owner_id = '$PLAN_OWNER' and plan_activated_at is not null;"
assert_value "one current Monthly Action exists" "1" \
  "select count(*) from public.sop_records where owner_id = '$PLAN_OWNER' and is_monthly_action;"
assert_value "one 12-node Plan Path exists" "12" \
  "select count(*) from public.monthly_milestones where owner_id = '$PLAN_OWNER' and is_plan_path;"

run_pair \
  "activation and Rule edit serialize" \
  "select public.activate_savings_plan();" \
  "select public.save_plan_rule('{\"rule_id\":\"$PLAN_RULE\",\"name\":\"Concurrent Rule Edited\",\"amount\":\"200.00\",\"due_day\":20,\"source_account_id\":null,\"target_account_id\":\"$PLAN_ACCOUNT\"}'::jsonb);"

assert_value "serialized edit leaves one Monthly Action" "1" \
  "select count(*) from public.sop_records where owner_id = '$PLAN_OWNER' and is_monthly_action;"
assert_value "current path equals its materialized Action" "1" \
  "select count(*) from public.monthly_milestones as path join public.sop_records as action on action.owner_id = path.owner_id and action.year_month = path.year_month where path.owner_id = '$PLAN_OWNER' and path.is_plan_path and action.is_monthly_action and path.year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM') and path.planned_savings = action.milestone_amount;"
assert_value "future path uses the final Rule amount" "200.00" \
  "select planned_savings from public.monthly_milestones where owner_id = '$PLAN_OWNER' and is_plan_path and year_month = to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') + interval '1 month', 'YYYY-MM');"

run_cross_owner_same_uuid_pair
assert_value "shared UUID creates exactly one global Rule row" "1" \
  "select count(*) from public.sop_templates where id = '$PLAN_SHARED_RULE';"

printf 'PASS: Savings Plan concurrency invariants\n'
