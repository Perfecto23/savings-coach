#!/usr/bin/env bash

set -euo pipefail

CLOSE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
CLOSE_OWNER_A="00000000-0000-4000-8000-00000000008c"
CLOSE_ACCOUNT_A="10000000-0000-4000-8000-00000000008c"
CLOSE_RULE_A="20000000-0000-4000-8000-00000000008c"
CLOSE_OWNER_B="00000000-0000-4000-8000-00000000008d"
CLOSE_ACCOUNT_B="10000000-0000-4000-8000-00000000008d"
CLOSE_RULE_B="20000000-0000-4000-8000-00000000008d"
CLOSE_OWNER_C="00000000-0000-4000-8000-00000000008e"
CLOSE_ACCOUNT_C="10000000-0000-4000-8000-00000000008e"
CLOSE_RULE_C="20000000-0000-4000-8000-00000000008e"
CLOSE_TMP_DIR="$(mktemp -d)"

cleanup() {
  set +e
  rm -r -- "$CLOSE_TMP_DIR"
  pnpm exec supabase db reset --no-seed >/dev/null 2>&1
}

trap cleanup EXIT

run_sql() {
  psql "$CLOSE_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

run_as_identity() {
  local owner_id="$1"
  local sql="$2"
  psql "$CLOSE_DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
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
  local owner_id="$2"
  local first_sql="$3"
  local second_sql="$4"
  local first_status
  local second_status

  set +e
  run_as_identity "$owner_id" "$first_sql" >"$CLOSE_TMP_DIR/first.log" 2>&1 &
  local first_pid=$!
  run_as_identity "$owner_id" "$second_sql" >"$CLOSE_TMP_DIR/second.log" 2>&1 &
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

run_close_with_hold() {
  psql "$CLOSE_DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$CLOSE_OWNER_C';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub":"$CLOSE_OWNER_C","role":"authenticated"}';
select pg_advisory_xact_lock(hashtextextended('$CLOSE_OWNER_C', 0));
select pg_sleep(0.5);
select public.close_monthly_review('$CLOSE_PREVIOUS_MONTH');
commit;
SQL
}

pnpm exec supabase db reset --no-seed >/dev/null

CLOSE_PREVIOUS_MONTH="$(run_sql "select to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM');")"
CLOSE_CURRENT_MONTH="$(run_sql "select to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');")"
CLOSE_PREVIOUS_START="${CLOSE_PREVIOUS_MONTH}-01"
CLOSE_CURRENT_DATE="$(run_sql "select (current_timestamp at time zone 'Asia/Singapore')::date;")"

run_sql "
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('$CLOSE_OWNER_A', 'authenticated', 'authenticated', 'close-concurrency-a@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('$CLOSE_OWNER_B', 'authenticated', 'authenticated', 'close-concurrency-b@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('$CLOSE_OWNER_C', 'authenticated', 'authenticated', 'close-concurrency-c@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values
    ('$CLOSE_ACCOUNT_A', '$CLOSE_OWNER_A', 'Close A Savings', null, 'savings'),
    ('$CLOSE_ACCOUNT_B', '$CLOSE_OWNER_B', 'Close B Savings', null, 'savings'),
    ('$CLOSE_ACCOUNT_C', '$CLOSE_OWNER_C', 'Close C Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id, plan_activated_at
  ) values
    ('$CLOSE_OWNER_A', 'en-SG', 'Asia/Singapore', 'SGD', '$CLOSE_ACCOUNT_A', now() - interval '2 months'),
    ('$CLOSE_OWNER_B', 'en-SG', 'Asia/Singapore', 'SGD', '$CLOSE_ACCOUNT_B', now() - interval '2 months'),
    ('$CLOSE_OWNER_C', 'en-SG', 'Asia/Singapore', 'SGD', '$CLOSE_ACCOUNT_C', now() - interval '2 months');
  insert into public.balance_snapshots (account_id, recorded_at, balance)
  values
    ('$CLOSE_ACCOUNT_A', '$CLOSE_CURRENT_DATE', 1000),
    ('$CLOSE_ACCOUNT_B', '$CLOSE_CURRENT_DATE', 2000),
    ('$CLOSE_ACCOUNT_C', '$CLOSE_CURRENT_DATE', 3000);
  insert into public.sop_templates (
    id, owner_id, step_key, step_label, due_day,
    to_account_id, default_amount, sort_order, is_active, is_plan_rule
  ) values
    ('$CLOSE_RULE_A', '$CLOSE_OWNER_A', 'close_rule_a', 'Close Rule A', 15, '$CLOSE_ACCOUNT_A', 100, 1, true, true),
    ('$CLOSE_RULE_B', '$CLOSE_OWNER_B', 'close_rule_b', 'Close Rule B', 15, '$CLOSE_ACCOUNT_B', 100, 1, true, true),
    ('$CLOSE_RULE_C', '$CLOSE_OWNER_C', 'close_rule_c', 'Close Rule C', 15, '$CLOSE_ACCOUNT_C', 100, 1, true, true);
  insert into public.monthly_milestones (
    owner_id, year_month, planned_savings, planned_total_savings, status, is_plan_path
  ) values
    ('$CLOSE_OWNER_A', '$CLOSE_PREVIOUS_MONTH', 100, 1000, 'pending', true),
    ('$CLOSE_OWNER_A', '$CLOSE_CURRENT_MONTH', 100, 1100, 'pending', true),
    ('$CLOSE_OWNER_B', '$CLOSE_PREVIOUS_MONTH', 100, 2000, 'pending', true),
    ('$CLOSE_OWNER_B', '$CLOSE_CURRENT_MONTH', 100, 2100, 'pending', true),
    ('$CLOSE_OWNER_C', '$CLOSE_PREVIOUS_MONTH', 100, 3000, 'pending', true),
    ('$CLOSE_OWNER_C', '$CLOSE_CURRENT_MONTH', 100, 3100, 'pending', true);
  insert into public.sop_records (
    owner_id, year_month, template_id, step_key, step_label,
    due_day, completed, completed_at, amount, sort_order,
    counts_toward_milestone, milestone_amount, is_monthly_action,
    rule_amount, scheduled_for, target_account_id, target_account_name
  ) values
    ('$CLOSE_OWNER_A', '$CLOSE_PREVIOUS_MONTH', '$CLOSE_RULE_A', 'close_rule_a', 'Close Rule A', 15, true, now(), 100, 1, true, 100, true, 100, public.plan_scheduled_date('$CLOSE_PREVIOUS_START', 15), '$CLOSE_ACCOUNT_A', 'Close A Savings'),
    ('$CLOSE_OWNER_B', '$CLOSE_PREVIOUS_MONTH', '$CLOSE_RULE_B', 'close_rule_b', 'Close Rule B', 15, true, now(), 100, 1, true, 100, true, 100, public.plan_scheduled_date('$CLOSE_PREVIOUS_START', 15), '$CLOSE_ACCOUNT_B', 'Close B Savings'),
    ('$CLOSE_OWNER_C', '$CLOSE_PREVIOUS_MONTH', '$CLOSE_RULE_C', 'close_rule_c', 'Close Rule C', 15, true, now(), 100, 1, true, 100, true, 100, public.plan_scheduled_date('$CLOSE_PREVIOUS_START', 15), '$CLOSE_ACCOUNT_C', 'Close C Savings');
  insert into public.sop_records (
    id, owner_id, year_month, template_id, step_key, step_label,
    due_day, completed, note, sort_order, is_monthly_action
  ) values
    ('81000000-0000-4000-8000-00000000008e', '$CLOSE_OWNER_C', '$CLOSE_PREVIOUS_MONTH', null, 'close_update_c', 'Close update C', 1, true, 'unchanged', 20, false),
    ('82000000-0000-4000-8000-00000000008e', '$CLOSE_OWNER_C', '$CLOSE_PREVIOUS_MONTH', null, 'close_delete_c', 'Close delete C', 2, true, null, 30, false);
"

run_pair \
  "duplicate Monthly Close requests converge" \
  "$CLOSE_OWNER_A" \
  "select public.close_monthly_review('$CLOSE_PREVIOUS_MONTH');" \
  "select public.close_monthly_review('$CLOSE_PREVIOUS_MONTH');"

assert_value "duplicate close stores one review timestamp" "1" \
  "select count(*) from public.monthly_milestones where owner_id = '$CLOSE_OWNER_A' and year_month = '$CLOSE_PREVIOUS_MONTH' and review_completed_at is not null;"
assert_value "duplicate close creates one current Monthly Action" "1" \
  "select count(*) from public.sop_records where owner_id = '$CLOSE_OWNER_A' and year_month = '$CLOSE_CURRENT_MONTH' and is_monthly_action;"
assert_value "duplicate close leaves one 12-node current horizon" "12" \
  "select count(*) from public.monthly_milestones where owner_id = '$CLOSE_OWNER_A' and is_plan_path and year_month >= '$CLOSE_CURRENT_MONTH';"

run_pair \
  "Monthly Close and Plan Rule edit serialize" \
  "$CLOSE_OWNER_B" \
  "select public.close_monthly_review('$CLOSE_PREVIOUS_MONTH');" \
  "select public.save_plan_rule('{\"rule_id\":\"$CLOSE_RULE_B\",\"name\":\"Close Rule B edited\",\"amount\":\"200.00\",\"due_day\":20,\"source_account_id\":null,\"target_account_id\":\"$CLOSE_ACCOUNT_B\"}'::jsonb);"

assert_value "serialized close/edit leaves a complete Action snapshot" "1" \
  "select case when (step_label = 'Close Rule B' and amount = 100 and rule_amount = 100 and due_day = 15) or (step_label = 'Close Rule B edited' and amount = 200 and rule_amount = 200 and due_day = 20) then 1 else 0 end from public.sop_records where owner_id = '$CLOSE_OWNER_B' and year_month = '$CLOSE_CURRENT_MONTH' and is_monthly_action;"
assert_value "serialized close/edit keeps current path aligned to its Action" "1" \
  "select case when path.planned_savings = action.milestone_amount then 1 else 0 end from public.monthly_milestones as path join public.sop_records as action on action.owner_id = path.owner_id and action.year_month = path.year_month and action.is_monthly_action where path.owner_id = '$CLOSE_OWNER_B' and path.year_month = '$CLOSE_CURRENT_MONTH' and path.is_plan_path;"
assert_value "owner B close does not change owner A review timestamp count" "1" \
  "select count(*) from public.monthly_milestones where owner_id = '$CLOSE_OWNER_A' and year_month = '$CLOSE_PREVIOUS_MONTH' and review_completed_at is not null;"

set +e
run_close_with_hold >"$CLOSE_TMP_DIR/held-close.log" 2>&1 &
close_pid=$!
run_as_identity "$CLOSE_OWNER_C" \
  "insert into public.sop_records (owner_id, year_month, template_id, step_key, step_label, due_day, is_monthly_action) values ('$CLOSE_OWNER_C', '$CLOSE_PREVIOUS_MONTH', null, 'close_insert_c', 'Close insert C', 3, false);" \
  >"$CLOSE_TMP_DIR/held-insert.log" 2>&1 &
insert_pid=$!
run_as_identity "$CLOSE_OWNER_C" \
  "update public.sop_records set note = 'changed' where id = '81000000-0000-4000-8000-00000000008e';" \
  >"$CLOSE_TMP_DIR/held-update.log" 2>&1 &
update_pid=$!
run_as_identity "$CLOSE_OWNER_C" \
  "delete from public.sop_records where id = '82000000-0000-4000-8000-00000000008e';" \
  >"$CLOSE_TMP_DIR/held-delete.log" 2>&1 &
delete_pid=$!
wait "$close_pid"
close_status=$?
wait "$insert_pid"
insert_status=$?
wait "$update_pid"
update_status=$?
wait "$delete_pid"
delete_status=$?
set -e

if [[ $close_status -ne 0 || $insert_status -eq 0 || $update_status -eq 0 || $delete_status -eq 0 ]]; then
  printf 'FAIL: held close/write statuses were %s/%s/%s/%s\n' \
    "$close_status" "$insert_status" "$update_status" "$delete_status" >&2
  exit 1
fi
for operation in insert update delete; do
  if ! grep -q 'month_review_closed' "$CLOSE_TMP_DIR/held-${operation}.log"; then
    printf 'FAIL: close-vs-%s did not report month_review_closed\n' "$operation" >&2
    exit 1
  fi
done

assert_value "close-vs-insert leaves no late SOP row" "0" \
  "select count(*) from public.sop_records where owner_id = '$CLOSE_OWNER_C' and step_key = 'close_insert_c';"
assert_value "close-vs-update preserves the legacy SOP row" "unchanged" \
  "select note from public.sop_records where id = '81000000-0000-4000-8000-00000000008e';"
assert_value "close-vs-delete preserves the legacy SOP row" "1" \
  "select count(*) from public.sop_records where id = '82000000-0000-4000-8000-00000000008e';"
printf 'PASS: close vs legacy SOP writes serialize\n'

printf 'PASS: Monthly Close concurrency invariants\n'
