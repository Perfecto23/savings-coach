#!/usr/bin/env bash

set -euo pipefail

SC_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SC_MIGRATION="supabase/migrations/004_owner_isolation.sql"
SC_USER_A="00000000-0000-4000-8000-00000000000a"
SC_USER_B="00000000-0000-4000-8000-00000000000b"

reset_before_owner() {
  pnpm exec supabase db reset --version 003 --no-seed >/dev/null
}

restore_current_schema() {
  pnpm exec supabase db reset --no-seed >/dev/null
}

run_sql() {
  psql "$SC_DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"
}

insert_auth_user() {
  local user_id="$1"
  run_sql "
    insert into auth.users (
      id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '$user_id', 'authenticated', 'authenticated',
      '$user_id@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    );
  "
}

insert_legacy_account() {
  run_sql "
    insert into public.accounts (id, name, bank, purpose)
    values ('10000000-0000-4000-8000-000000000001', 'Legacy Account', 'Legacy Bank', 'savings');
  "
}

apply_owner_migration() {
  psql "$SC_DB_URL" -v ON_ERROR_STOP=1 -q -f "$SC_MIGRATION" >/dev/null
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

expect_preflight_failure() {
  local scenario="$1"
  local migration_output
  local migration_status

  set +e
  migration_output="$(psql "$SC_DB_URL" -v ON_ERROR_STOP=1 -q -f "$SC_MIGRATION" 2>&1)"
  migration_status=$?
  set -e

  if [[ $migration_status -eq 0 ]]; then
    printf 'FAIL: %s unexpectedly applied the migration\n' "$scenario" >&2
    exit 1
  fi
  if [[ "$migration_output" != *"owner isolation preflight failed"* ]]; then
    printf 'FAIL: %s returned the wrong failure\n' "$scenario" >&2
    exit 1
  fi

  assert_value "$scenario keeps the legacy row" "1" \
    "select count(*) from public.accounts where name = 'Legacy Account';"
  assert_value "$scenario leaves the schema unchanged" "0" \
    "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'accounts' and column_name = 'owner_id';"
  printf 'PASS: %s\n' "$scenario"
}

trap restore_current_schema EXIT

reset_before_owner
apply_owner_migration
assert_value "empty database with no Auth user applies" "9" \
  "select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'owner_id';"
printf 'PASS: empty database with no Auth user\n'

reset_before_owner
insert_auth_user "$SC_USER_A"
insert_auth_user "$SC_USER_B"
apply_owner_migration
assert_value "empty database with two Auth users applies" "9" \
  "select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'owner_id';"
printf 'PASS: empty database with two Auth users\n'

reset_before_owner
insert_legacy_account
expect_preflight_failure "legacy data with no Auth user"

reset_before_owner
insert_auth_user "$SC_USER_A"
insert_auth_user "$SC_USER_B"
insert_legacy_account
expect_preflight_failure "legacy data with two Auth users"

reset_before_owner
insert_auth_user "$SC_USER_A"
insert_legacy_account
apply_owner_migration
assert_value "single-user legacy row is backfilled" "$SC_USER_A" \
  "select owner_id from public.accounts where name = 'Legacy Account';"
assert_value "single-user backfill preserves row count" "1" \
  "select count(*) from public.accounts where name = 'Legacy Account';"
printf 'PASS: legacy data with one Auth user\n'
