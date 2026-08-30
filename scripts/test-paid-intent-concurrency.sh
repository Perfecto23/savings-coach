#!/usr/bin/env bash

set -euo pipefail

INTENT_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
INTENT_OWNER_A="00000000-0000-4000-8000-00000000010d"
INTENT_OWNER_B="00000000-0000-4000-8000-00000000010e"
INTENT_OWNER_C="00000000-0000-4000-8000-00000000010f"
INTENT_ACCOUNT_C="10000000-0000-4000-8000-00000000010f"
INTENT_RULE_C="20000000-0000-4000-8000-00000000010f"
INTENT_TMP_DIR="$(mktemp -d)"

cleanup() {
  set +e
  rm -r -- "$INTENT_TMP_DIR"
  pnpm exec supabase db reset --no-seed >/dev/null 2>&1
}

trap cleanup EXIT

run_sql() {
  psql "$INTENT_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

run_as_identity() {
  local owner_id="$1"
  local sql="$2"
  psql "$INTENT_DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
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

pnpm exec supabase db reset --no-seed >/dev/null

INTENT_PREVIOUS_MONTH="$(run_sql "select to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore') - interval '1 month', 'YYYY-MM');")"
INTENT_CURRENT_MONTH="$(run_sql "select to_char(date_trunc('month', current_timestamp at time zone 'Asia/Singapore'), 'YYYY-MM');")"
INTENT_PREVIOUS_START="${INTENT_PREVIOUS_MONTH}-01"
INTENT_LOCAL_DATE="$(run_sql "select (current_timestamp at time zone 'Asia/Singapore')::date;")"

run_sql "
  insert into auth.users (
    id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('$INTENT_OWNER_A', 'authenticated', 'authenticated', 'intent-concurrency-a@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('$INTENT_OWNER_B', 'authenticated', 'authenticated', 'intent-concurrency-b@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('$INTENT_OWNER_C', 'authenticated', 'authenticated', 'intent-concurrency-c@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.accounts (id, owner_id, name, bank, purpose)
  values ('$INTENT_ACCOUNT_C', '$INTENT_OWNER_C', 'Intent C Savings', null, 'savings');
  insert into public.owner_setup (
    owner_id, locale, time_zone, base_currency, savings_account_id, plan_activated_at
  ) values
    ('$INTENT_OWNER_A', 'en-SG', 'Asia/Singapore', 'SGD', null, null),
    ('$INTENT_OWNER_B', 'en-US', 'America/New_York', 'USD', null, null),
    ('$INTENT_OWNER_C', 'en-SG', 'Asia/Singapore', 'SGD', '$INTENT_ACCOUNT_C', now() - interval '2 months');
  insert into public.monthly_milestones (
    owner_id, year_month, planned_savings, planned_total_savings,
    status, is_plan_path, review_completed_at
  ) values
    ('$INTENT_OWNER_A', '$INTENT_PREVIOUS_MONTH', 0, 0, 'on_track', true, now()),
    ('$INTENT_OWNER_B', '$INTENT_PREVIOUS_MONTH', 0, 0, 'on_track', true, now()),
    ('$INTENT_OWNER_C', '$INTENT_PREVIOUS_MONTH', 100, 1000, 'pending', true, null),
    ('$INTENT_OWNER_C', '$INTENT_CURRENT_MONTH', 100, 1100, 'pending', true, null);
  insert into public.balance_snapshots (account_id, recorded_at, balance)
  values ('$INTENT_ACCOUNT_C', '$INTENT_LOCAL_DATE', 1000);
  insert into public.sop_templates (
    id, owner_id, step_key, step_label, due_day,
    to_account_id, default_amount, sort_order, is_active, is_plan_rule
  ) values (
    '$INTENT_RULE_C', '$INTENT_OWNER_C', 'intent_rule_c',
    'Intent Rule C', 15, '$INTENT_ACCOUNT_C', 100, 1, true, true
  );
  insert into public.sop_records (
    owner_id, year_month, template_id, step_key, step_label,
    due_day, completed, completed_at, amount, sort_order,
    counts_toward_milestone, milestone_amount, is_monthly_action,
    rule_amount, scheduled_for, target_account_id, target_account_name
  ) values (
    '$INTENT_OWNER_C', '$INTENT_PREVIOUS_MONTH', '$INTENT_RULE_C',
    'intent_rule_c', 'Intent Rule C', 15, true, now(), 100, 1,
    true, 100, true, 100,
    public.plan_scheduled_date('$INTENT_PREVIOUS_START', 15),
    '$INTENT_ACCOUNT_C', 'Intent C Savings'
  );
"

set +e
run_as_identity "$INTENT_OWNER_A" "select public.record_paid_intent();" \
  >"$INTENT_TMP_DIR/duplicate-first.log" 2>&1 &
first_pid=$!
run_as_identity "$INTENT_OWNER_A" "select public.record_paid_intent();" \
  >"$INTENT_TMP_DIR/duplicate-second.log" 2>&1 &
second_pid=$!
wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

if [[ $first_status -ne 0 || $second_status -ne 0 ]]; then
  printf 'FAIL: duplicate Paid Intent statuses were %s/%s\n' \
    "$first_status" "$second_status" >&2
  exit 1
fi
INTENT_RECORDED_NOW_COUNT="$(
  grep -h '"recorded_now": true' \
    "$INTENT_TMP_DIR/duplicate-first.log" "$INTENT_TMP_DIR/duplicate-second.log" \
    | wc -l | tr -d ' '
)"
if [[ "$INTENT_RECORDED_NOW_COUNT" != "1" ]]; then
  printf 'FAIL: duplicate Paid Intent recorded_now=true count was %s\n' \
    "$INTENT_RECORDED_NOW_COUNT" >&2
  exit 1
fi
assert_value "duplicate intent stores one frozen receipt" "1" \
  "select count(*) from public.owner_setup where owner_id = '$INTENT_OWNER_A' and paid_intent_offer_code = 'pro_beta_usd_499_monthly_v1' and paid_intent_recorded_at is not null;"
printf 'PASS: duplicate Paid Intent converges\n'

set +e
run_as_identity "$INTENT_OWNER_A" "select public.record_paid_intent();" \
  >"$INTENT_TMP_DIR/owner-a-repeat.log" 2>&1 &
owner_a_pid=$!
run_as_identity "$INTENT_OWNER_B" "select public.record_paid_intent();" \
  >"$INTENT_TMP_DIR/owner-b-first.log" 2>&1 &
owner_b_pid=$!
wait "$owner_a_pid"
owner_a_status=$?
wait "$owner_b_pid"
owner_b_status=$?
set -e
if [[ $owner_a_status -ne 0 || $owner_b_status -ne 0 ]]; then
  printf 'FAIL: A/B Paid Intent statuses were %s/%s\n' \
    "$owner_a_status" "$owner_b_status" >&2
  exit 1
fi
assert_value "A/B Paid Intent records independently" "2" \
  "select count(*) from public.owner_setup where owner_id in ('$INTENT_OWNER_A', '$INTENT_OWNER_B') and paid_intent_recorded_at is not null;"
printf 'PASS: A/B Paid Intent is independent\n'

set +e
run_as_identity "$INTENT_OWNER_C" \
  "select public.close_monthly_review('$INTENT_PREVIOUS_MONTH');" \
  >"$INTENT_TMP_DIR/close.log" 2>&1 &
close_pid=$!
run_as_identity "$INTENT_OWNER_C" "select public.record_paid_intent();" \
  >"$INTENT_TMP_DIR/close-record.log" 2>&1 &
record_pid=$!
wait "$close_pid"
close_status=$?
wait "$record_pid"
record_status=$?
set -e

if [[ $close_status -ne 0 ]]; then
  printf 'FAIL: close-vs-intent close status was %s\n' "$close_status" >&2
  exit 1
fi
if [[ $record_status -ne 0 ]] \
  && ! grep -q 'paid_intent_not_eligible' "$INTENT_TMP_DIR/close-record.log"
then
  printf 'FAIL: close-vs-intent failure was not eligibility-gated\n' >&2
  exit 1
fi
assert_value "close-vs-intent leaves completed review eligibility" "1" \
  "select count(*) from public.monthly_milestones where owner_id = '$INTENT_OWNER_C' and review_completed_at is not null;"
assert_value "close-vs-intent leaves a coherent receipt state" "1" \
  "select case when paid_intent_recorded_at is null or paid_intent_offer_code = 'pro_beta_usd_499_monthly_v1' then 1 else 0 end from public.owner_setup where owner_id = '$INTENT_OWNER_C';"
printf 'PASS: Monthly Close and Paid Intent serialize\n'

printf 'PASS: Paid Intent concurrency invariants\n'
