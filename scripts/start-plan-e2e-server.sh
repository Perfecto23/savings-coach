#!/usr/bin/env bash

set -euo pipefail

plan_port="${1:-43119}"
plan_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plan_runtime_dir="${plan_root}/.setup-e2e/plan"
plan_status_file="${plan_runtime_dir}/supabase.env"
plan_curl_config="${plan_runtime_dir}/curl.conf"
plan_log_file="${plan_runtime_dir}/supabase.log"
next_log_file="${plan_runtime_dir}/next.log"
next_pid=""

umask 077
rm -rf "${plan_runtime_dir}"
mkdir -p "${plan_runtime_dir}"

cleanup() {
  if [[ -n "${next_pid}" ]] && kill -0 "${next_pid}" 2>/dev/null; then
    kill "${next_pid}" 2>/dev/null || true
    wait "${next_pid}" 2>/dev/null || true
  fi
  rm -rf "${plan_runtime_dir}"
}

terminate() {
  exit 0
}

trap cleanup EXIT
trap terminate INT TERM

cd "${plan_root}"

if ! pnpm exec supabase status -o env >"${plan_status_file}" 2>"${plan_log_file}"; then
  if ! pnpm exec supabase start >"${plan_log_file}" 2>&1; then
    echo "Plan E2E could not start local Supabase." >&2
    exit 1
  fi
fi

if ! pnpm exec supabase db reset >"${plan_log_file}" 2>&1; then
  echo "Plan E2E could not reset the local database." >&2
  exit 1
fi

if ! pnpm exec supabase status -o env >"${plan_status_file}" 2>>"${plan_log_file}"; then
  echo "Plan E2E could not capture local Supabase status." >&2
  exit 1
fi

# The local CLI owns this private file. It is never printed and is removed by
# the EXIT trap. shellcheck disable=SC1090
source "${plan_status_file}"

: "${API_URL:?local Supabase API_URL is missing}"
: "${ANON_KEY:?local Supabase ANON_KEY is missing}"
: "${SERVICE_ROLE_KEY:?local Supabase SERVICE_ROLE_KEY is missing}"

if [[ "${REVIEW_EMAIL_FEATURE_ENABLED:-false}" == "true" ]]; then
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -qAt <<'SQL'
grant execute on function public.configure_review_email_reminder(boolean) to authenticated;
grant execute on function public.get_review_email_reminder_state() to authenticated;
SQL
fi

printf '%s\n' \
  'silent' \
  'show-error' \
  'fail-with-body' \
  "header = \"apikey: ${SERVICE_ROLE_KEY}\"" \
  "header = \"Authorization: Bearer ${SERVICE_ROLE_KEY}\"" \
  'header = "Content-Type: application/json"' \
  >"${plan_curl_config}"

run_id="$(date -u +%Y%m%d%H%M%S)-$$"
owner_a_email="plan-a-${run_id}@example.invalid"
owner_b_email="plan-b-${run_id}@example.invalid"
owner_c_email="plan-canary-${run_id}@example.invalid"
owner_a_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
owner_b_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
owner_c_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
other_owner_canary="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
secret_canary="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')"

create_local_user() {
  local label="$1"
  local email="$2"
  local password="$3"
  local request_file="${plan_runtime_dir}/${label}-request.json"
  local response_file="${plan_runtime_dir}/${label}-response.json"

  OUTPUT_FILE="${request_file}" USER_EMAIL="${email}" USER_PASSWORD="${password}" \
    node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify({
    email: process.env.USER_EMAIL,
    password: process.env.USER_PASSWORD,
    email_confirm: true,
  }),
  { mode: 0o600 },
);
NODE

  curl --config "${plan_curl_config}" \
    --request POST \
    --data-binary "@${request_file}" \
    --output "${response_file}" \
    "${API_URL}/auth/v1/admin/users"

  RESPONSE_FILE="${response_file}" node <<'NODE'
const fs = require("node:fs");
const response = JSON.parse(fs.readFileSync(process.env.RESPONSE_FILE, "utf8"));

if (typeof response.id !== "string" || response.id.length === 0) {
  process.exit(1);
}

process.stdout.write(response.id);
NODE
}

post_rows() {
  local table="$1"
  local body_file="$2"
  local response_file="${plan_runtime_dir}/seed-${table}-response.json"

  if ! curl --config "${plan_curl_config}" \
    --header "Prefer: return=minimal" \
    --request POST \
    --data-binary "@${body_file}" \
    --output "${response_file}" \
    "${API_URL}/rest/v1/${table}"; then
    echo "Plan E2E could not seed ${table}." >&2
    RESPONSE_FILE="${response_file}" node <<'NODE' >&2
const fs = require("node:fs");
try {
  const response = JSON.parse(fs.readFileSync(process.env.RESPONSE_FILE, "utf8"));
  process.stderr.write(
    JSON.stringify({
      code: response.code,
      message: response.message,
      details: response.details,
      hint: response.hint,
    }) + "\n",
  );
} catch {
  process.stderr.write("The seed error response was not valid JSON.\n");
}
NODE
    return 1
  fi
}

owner_a_id="$(create_local_user owner-a "${owner_a_email}" "${owner_a_password}")"
owner_b_id="$(create_local_user owner-b "${owner_b_email}" "${owner_b_password}")"
owner_c_id="$(create_local_user owner-canary "${owner_c_email}" "${owner_c_password}")"

owner_a_account_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
owner_b_account_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
owner_c_account_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
balance_as_of="$(node <<'NODE'
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
process.stdout.write(`${value.year}-${value.month}-${value.day}`);
NODE
)"

accounts_request="${plan_runtime_dir}/accounts.json"
setup_request="${plan_runtime_dir}/owner-setup.json"
snapshots_request="${plan_runtime_dir}/snapshots.json"
canary_ai_request="${plan_runtime_dir}/canary-ai.json"

OUTPUT_FILE="${accounts_request}" \
OWNER_A_ID="${owner_a_id}" OWNER_B_ID="${owner_b_id}" OWNER_C_ID="${owner_c_id}" \
OWNER_A_ACCOUNT_ID="${owner_a_account_id}" OWNER_B_ACCOUNT_ID="${owner_b_account_id}" \
OWNER_C_ACCOUNT_ID="${owner_c_account_id}" OTHER_OWNER_CANARY="${other_owner_canary}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify([
    {
      id: process.env.OWNER_A_ACCOUNT_ID,
      owner_id: process.env.OWNER_A_ID,
      name: "Desktop Starting Point",
      bank: null,
      purpose: "savings",
    },
    {
      id: process.env.OWNER_B_ACCOUNT_ID,
      owner_id: process.env.OWNER_B_ID,
      name: "Mobile Starting Point",
      bank: null,
      purpose: "savings",
    },
    {
      id: process.env.OWNER_C_ACCOUNT_ID,
      owner_id: process.env.OWNER_C_ID,
      name: process.env.OTHER_OWNER_CANARY,
      bank: null,
      purpose: "savings",
    },
  ]),
  { mode: 0o600 },
);
NODE
post_rows accounts "${accounts_request}"

OUTPUT_FILE="${setup_request}" \
OWNER_A_ID="${owner_a_id}" OWNER_B_ID="${owner_b_id}" OWNER_C_ID="${owner_c_id}" \
OWNER_A_ACCOUNT_ID="${owner_a_account_id}" OWNER_B_ACCOUNT_ID="${owner_b_account_id}" \
OWNER_C_ACCOUNT_ID="${owner_c_account_id}" REVIEW_E2E="${REVIEW_E2E:-0}" \
IMPULSE_E2E="${IMPULSE_E2E:-0}" \
  node <<'NODE'
const fs = require("node:fs");

const activation =
  process.env.REVIEW_E2E === "1"
    ? { plan_activated_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString() }
    : {};
const ownerALocale = process.env.IMPULSE_E2E === "1" ? "zh-CN" : "en-SG";
const ownerABaseCurrency = process.env.IMPULSE_E2E === "1" ? "CNY" : "SGD";

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify([
    {
      owner_id: process.env.OWNER_A_ID,
      locale: ownerALocale,
      time_zone: "Asia/Singapore",
      base_currency: ownerABaseCurrency,
      savings_account_id: process.env.OWNER_A_ACCOUNT_ID,
      plan_activated_at: activation.plan_activated_at ?? null,
    },
    {
      owner_id: process.env.OWNER_B_ID,
      locale: "en-SG",
      time_zone: "Asia/Singapore",
      base_currency: "SGD",
      savings_account_id: process.env.OWNER_B_ACCOUNT_ID,
      plan_activated_at: activation.plan_activated_at ?? null,
    },
    {
      owner_id: process.env.OWNER_C_ID,
      locale: "en-SG",
      time_zone: "Asia/Singapore",
      base_currency: "SGD",
      savings_account_id: process.env.OWNER_C_ACCOUNT_ID,
      plan_activated_at: null,
    },
  ]),
  { mode: 0o600 },
);
NODE
post_rows owner_setup "${setup_request}"

OUTPUT_FILE="${snapshots_request}" BALANCE_AS_OF="${balance_as_of}" \
OWNER_A_ACCOUNT_ID="${owner_a_account_id}" OWNER_B_ACCOUNT_ID="${owner_b_account_id}" \
OWNER_C_ACCOUNT_ID="${owner_c_account_id}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify([
    { account_id: process.env.OWNER_A_ACCOUNT_ID, recorded_at: process.env.BALANCE_AS_OF, balance: 1000 },
    { account_id: process.env.OWNER_B_ACCOUNT_ID, recorded_at: process.env.BALANCE_AS_OF, balance: 1000 },
    { account_id: process.env.OWNER_C_ACCOUNT_ID, recorded_at: process.env.BALANCE_AS_OF, balance: 1000 },
  ]),
  { mode: 0o600 },
);
NODE
post_rows balance_snapshots "${snapshots_request}"

OUTPUT_FILE="${canary_ai_request}" OWNER_ID="${owner_c_id}" SECRET_CANARY="${secret_canary}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify({
    owner_id: process.env.OWNER_ID,
    provider_name: "plan-e2e-canary",
    api_url: "https://example.invalid/v1",
    api_key: process.env.SECRET_CANARY,
    model_name: "disabled-canary",
    is_active: false,
  }),
  { mode: 0o600 },
);
NODE
post_rows ai_configs "${canary_ai_request}"

review_year_month=""
current_year_month=""
if [[ "${REVIEW_E2E:-0}" == "1" ]]; then
  review_year_month="$(node <<'NODE'
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
}).formatToParts(new Date());
const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
const current = new Date(`${values.year}-${values.month}-01T00:00:00.000Z`);
current.setUTCMonth(current.getUTCMonth() - 1);
process.stdout.write(current.toISOString().slice(0, 7));
NODE
)"
  current_year_month="$(node <<'NODE'
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
}).formatToParts(new Date());
const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
process.stdout.write(`${values.year}-${values.month}`);
NODE
)"

  review_rules_request="${plan_runtime_dir}/review-rules.json"
  review_actions_request="${plan_runtime_dir}/review-actions.json"
  review_path_request="${plan_runtime_dir}/review-path.json"
  owner_a_rule_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
  owner_b_rule_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"

  OUTPUT_FILE="${review_rules_request}" \
  OWNER_A_ID="${owner_a_id}" OWNER_B_ID="${owner_b_id}" \
  OWNER_A_RULE_ID="${owner_a_rule_id}" OWNER_B_RULE_ID="${owner_b_rule_id}" \
  OWNER_A_ACCOUNT_ID="${owner_a_account_id}" OWNER_B_ACCOUNT_ID="${owner_b_account_id}" \
    node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify([
    {
      id: process.env.OWNER_A_RULE_ID,
      owner_id: process.env.OWNER_A_ID,
      step_key: "review_desktop_monthly_action",
      step_label: "Desktop Monthly Review Action",
      due_day: 28,
      to_account_id: process.env.OWNER_A_ACCOUNT_ID,
      default_amount: 500,
      sort_order: 10,
      is_active: true,
      is_plan_rule: true,
    },
    {
      id: process.env.OWNER_B_RULE_ID,
      owner_id: process.env.OWNER_B_ID,
      step_key: "review_mobile_monthly_action",
      step_label: "Mobile Monthly Review Action",
      due_day: 28,
      to_account_id: process.env.OWNER_B_ACCOUNT_ID,
      default_amount: 500,
      sort_order: 10,
      is_active: true,
      is_plan_rule: true,
    },
  ]),
  { mode: 0o600 },
);
NODE
  post_rows sop_templates "${review_rules_request}"

  OUTPUT_FILE="${review_actions_request}" REVIEW_YEAR_MONTH="${review_year_month}" \
  OWNER_A_ID="${owner_a_id}" OWNER_B_ID="${owner_b_id}" \
  OWNER_A_RULE_ID="${owner_a_rule_id}" OWNER_B_RULE_ID="${owner_b_rule_id}" \
  OWNER_A_ACCOUNT_ID="${owner_a_account_id}" OWNER_B_ACCOUNT_ID="${owner_b_account_id}" \
    node <<'NODE'
const fs = require("node:fs");

function action(owner, template, key, label, account, targetName) {
  return {
    owner_id: owner,
    year_month: process.env.REVIEW_YEAR_MONTH,
    template_id: template,
    step_key: key,
    step_label: label,
    due_day: 28,
    amount: 500,
    sort_order: 10,
    counts_toward_milestone: true,
    milestone_amount: 500,
    completed: true,
    completed_at: new Date().toISOString(),
    is_monthly_action: true,
    rule_amount: 500,
    scheduled_for: `${process.env.REVIEW_YEAR_MONTH}-28`,
    target_account_id: account,
    target_account_name: targetName,
  };
}

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify([
    action(
      process.env.OWNER_A_ID,
      process.env.OWNER_A_RULE_ID,
      "review_desktop_monthly_action",
      "Desktop Monthly Review Action",
      process.env.OWNER_A_ACCOUNT_ID,
      "Desktop Starting Point",
    ),
    action(
      process.env.OWNER_B_ID,
      process.env.OWNER_B_RULE_ID,
      "review_mobile_monthly_action",
      "Mobile Monthly Review Action",
      process.env.OWNER_B_ACCOUNT_ID,
      "Mobile Starting Point",
    ),
  ]),
  { mode: 0o600 },
);
NODE
  post_rows sop_records "${review_actions_request}"

  OUTPUT_FILE="${review_path_request}" REVIEW_YEAR_MONTH="${review_year_month}" \
  OWNER_A_ID="${owner_a_id}" OWNER_B_ID="${owner_b_id}" \
    node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify([
    {
      owner_id: process.env.OWNER_A_ID,
      year_month: process.env.REVIEW_YEAR_MONTH,
      planned_savings: 500,
      planned_total_savings: 1500,
      status: "on_track",
      is_plan_path: true,
    },
    {
      owner_id: process.env.OWNER_B_ID,
      year_month: process.env.REVIEW_YEAR_MONTH,
      planned_savings: 500,
      planned_total_savings: 1500,
      status: "on_track",
      is_plan_path: true,
    },
  ]),
  { mode: 0o600 },
);
NODE
  post_rows monthly_milestones "${review_path_request}"
fi

FIXTURE_FILE="${plan_runtime_dir}/fixtures.json" IMPULSE_E2E="${IMPULSE_E2E:-0}" \
OWNER_A_EMAIL="${owner_a_email}" OWNER_A_PASSWORD="${owner_a_password}" \
OWNER_B_EMAIL="${owner_b_email}" OWNER_B_PASSWORD="${owner_b_password}" \
OTHER_OWNER_CANARY="${other_owner_canary}" SECRET_CANARY="${secret_canary}" \
REVIEW_YEAR_MONTH="${review_year_month}" CURRENT_YEAR_MONTH="${current_year_month}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.FIXTURE_FILE,
  JSON.stringify(process.env.IMPULSE_E2E === "1" ? {
    "desktop-zh-chromium": {
      email: process.env.OWNER_A_EMAIL,
      password: process.env.OWNER_A_PASSWORD,
      ruleName: "Desktop Monthly Transfer",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
    },
    "mobile-zh-chromium": {
      email: process.env.OWNER_A_EMAIL,
      password: process.env.OWNER_A_PASSWORD,
      ruleName: "Mobile Monthly Transfer",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
    },
    "desktop-en-chromium": {
      email: process.env.OWNER_B_EMAIL,
      password: process.env.OWNER_B_PASSWORD,
      ruleName: "Desktop Monthly Transfer",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
    },
    "mobile-en-chromium": {
      email: process.env.OWNER_B_EMAIL,
      password: process.env.OWNER_B_PASSWORD,
      ruleName: "Mobile Monthly Transfer",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
    },
  } : {
    "desktop-chromium": {
      email: process.env.OWNER_A_EMAIL,
      password: process.env.OWNER_A_PASSWORD,
      ruleName: "Desktop Monthly Transfer",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
      reviewYearMonth: process.env.REVIEW_YEAR_MONTH || undefined,
      currentYearMonth: process.env.CURRENT_YEAR_MONTH || undefined,
    },
    "mobile-chromium": {
      email: process.env.OWNER_B_EMAIL,
      password: process.env.OWNER_B_PASSWORD,
      ruleName: "Mobile Monthly Transfer",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
      reviewYearMonth: process.env.REVIEW_YEAR_MONTH || undefined,
      currentYearMonth: process.env.CURRENT_YEAR_MONTH || undefined,
    },
  }),
  { mode: 0o600 },
);
NODE

# The application receives only the local public Supabase boundary. Known
# server-secret names are fixed empty so dotenv loading cannot populate them.
env -i \
  PATH="${PATH}" \
  HOME="${HOME:-/tmp}" \
  TMPDIR="${TMPDIR:-/tmp}" \
  SHELL="${SHELL:-/bin/sh}" \
  NODE_ENV="development" \
  NEXT_TELEMETRY_DISABLED="1" \
  NEXT_PUBLIC_SUPABASE_URL="${API_URL}" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="" \
  SUPABASE_SECRET_KEY="" \
  SERVICE_ROLE_KEY="" \
  OPENAI_API_KEY="" \
  REVIEW_EMAIL_FEATURE_ENABLED="${REVIEW_EMAIL_FEATURE_ENABLED:-false}" \
  pnpm exec next dev --hostname 127.0.0.1 --port "${plan_port}" \
  >"${next_log_file}" 2>&1 &

next_pid="$!"
wait "${next_pid}"
