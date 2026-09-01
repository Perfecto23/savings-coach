#!/usr/bin/env bash

set -euo pipefail

setup_port="${1:-43118}"
setup_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
setup_runtime_dir="${setup_root}/.setup-e2e"
setup_lock_dir="/tmp/savings-coach-plan-e2e.lock"
run_token="${SAVINGS_E2E_RUN_TOKEN:-manual-$$}"
setup_status_file="${setup_runtime_dir}/supabase.env"
setup_curl_config="${setup_runtime_dir}/curl.conf"
setup_public_curl_config="${setup_runtime_dir}/public-curl.conf"
setup_log_file="${setup_runtime_dir}/supabase.log"
next_log_file="${setup_runtime_dir}/next.log"
next_pid=""
lock_acquired="0"

umask 077

cleanup() {
  if [[ -n "${next_pid}" ]] && kill -0 "${next_pid}" 2>/dev/null; then
    kill "${next_pid}" 2>/dev/null || true
    wait "${next_pid}" 2>/dev/null || true
  fi
  runtime_token=""
  if [[ -f "${setup_runtime_dir}/.run-token" ]]; then
    read -r runtime_token <"${setup_runtime_dir}/.run-token" || true
  fi
  if [[ "${runtime_token}" == "${run_token}" ]]; then
    rm -rf "${setup_runtime_dir}"
  fi

  lock_token=""
  if [[ -f "${setup_lock_dir}/token" ]]; then
    read -r lock_token <"${setup_lock_dir}/token" || true
  fi
  if [[ "${lock_acquired}" == "1" && "${lock_token}" == "${run_token}" ]]; then
    rm -rf "${setup_lock_dir}"
  fi
}

terminate() {
  exit 0
}

trap cleanup EXIT
trap terminate INT TERM

if ! mkdir "${setup_lock_dir}" 2>/dev/null; then
  lock_pid=""
  if [[ -f "${setup_lock_dir}/pid" ]]; then
    read -r lock_pid <"${setup_lock_dir}/pid" || true
  fi
  if [[ -n "${lock_pid}" ]] && ! kill -0 "${lock_pid}" 2>/dev/null; then
    stale_runtime=""
    if [[ -f "${setup_lock_dir}/runtime" ]]; then
      read -r stale_runtime <"${setup_lock_dir}/runtime" || true
    fi
    case "${stale_runtime}" in
      "${setup_root}/.setup-e2e"|"${setup_root}/.setup-e2e/plan")
        rm -rf "${stale_runtime}"
        ;;
    esac
    rm -rf "${setup_lock_dir}"
    mkdir "${setup_lock_dir}"
  else
    echo "Another authenticated E2E run is using the local Supabase project." >&2
    exit 1
  fi
fi
lock_acquired="1"
printf '%s\n' "$$" >"${setup_lock_dir}/pid"
printf '%s\n' "${run_token}" >"${setup_lock_dir}/token"
printf '%s\n' "${setup_runtime_dir}" >"${setup_lock_dir}/runtime"

rm -rf "${setup_runtime_dir}"
mkdir -p "${setup_runtime_dir}"
printf '%s\n' "${run_token}" >"${setup_runtime_dir}/.run-token"

cd "${setup_root}"

if ! pnpm exec supabase start >"${setup_log_file}" 2>&1; then
  echo "Setup E2E could not start local Supabase." >&2
  exit 1
fi

if ! pnpm exec supabase db reset >"${setup_log_file}" 2>&1; then
  echo "Setup E2E could not reset the local database." >&2
  exit 1
fi

if ! pnpm exec supabase status -o env >"${setup_status_file}" 2>>"${setup_log_file}"; then
  echo "Setup E2E could not capture local Supabase status." >&2
  exit 1
fi

# The local CLI owns this file. It is private, never printed, and removed by the
# EXIT trap. shellcheck disable=SC1090
source "${setup_status_file}"

: "${API_URL:?local Supabase API_URL is missing}"
: "${ANON_KEY:?local Supabase ANON_KEY is missing}"
: "${SERVICE_ROLE_KEY:?local Supabase SERVICE_ROLE_KEY is missing}"

printf '%s\n' \
  'silent' \
  'show-error' \
  'fail-with-body' \
  "header = \"apikey: ${SERVICE_ROLE_KEY}\"" \
  "header = \"Authorization: Bearer ${SERVICE_ROLE_KEY}\"" \
  'header = "Content-Type: application/json"' \
  >"${setup_curl_config}"

printf '%s\n' \
  'silent' \
  'show-error' \
  "header = \"apikey: ${ANON_KEY}\"" \
  'header = "Content-Type: application/json"' \
  >"${setup_public_curl_config}"

run_id="$(date -u +%Y%m%d%H%M%S)-$$"
owner_a_email="setup-a-${run_id}@example.invalid"
owner_b_email="setup-b-${run_id}@example.invalid"
owner_c_email="setup-canary-${run_id}@example.invalid"
owner_a_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
owner_b_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
owner_c_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
other_owner_canary="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
secret_canary="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')"
signup_probe_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"

signup_probe_request="${setup_runtime_dir}/signup-probe-request.json"
signup_probe_response="${setup_runtime_dir}/signup-probe-response.json"
OUTPUT_FILE="${signup_probe_request}" RUN_ID="${run_id}" SIGNUP_PASSWORD="${signup_probe_password}" node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify({
    email: `public-signup-${process.env.RUN_ID}@example.invalid`,
    password: process.env.SIGNUP_PASSWORD,
  }),
  { mode: 0o600 },
);
NODE

signup_status="$(curl --config "${setup_public_curl_config}" \
  --request POST \
  --data-binary "@${signup_probe_request}" \
  --output "${signup_probe_response}" \
  --write-out '%{http_code}' \
  "${API_URL}/auth/v1/signup")"

if [[ "${signup_status}" == 2* ]]; then
  echo "Setup E2E found public signup enabled." >&2
  exit 1
fi

create_local_user() {
  local label="$1"
  local email="$2"
  local password="$3"
  local request_file="${setup_runtime_dir}/${label}-request.json"
  local response_file="${setup_runtime_dir}/${label}-response.json"

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

  curl --config "${setup_curl_config}" \
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

owner_a_id="$(create_local_user owner-a "${owner_a_email}" "${owner_a_password}")"
owner_b_id="$(create_local_user owner-b "${owner_b_email}" "${owner_b_password}")"
owner_c_id="$(create_local_user owner-canary "${owner_c_email}" "${owner_c_password}")"

canary_account_request="${setup_runtime_dir}/canary-account.json"
canary_ai_request="${setup_runtime_dir}/canary-ai.json"

OUTPUT_FILE="${canary_account_request}" OWNER_ID="${owner_c_id}" CANARY="${other_owner_canary}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify({
    owner_id: process.env.OWNER_ID,
    name: process.env.CANARY,
    bank: null,
    purpose: "savings",
  }),
  { mode: 0o600 },
);
NODE

curl --config "${setup_curl_config}" \
  --header "Prefer: return=minimal" \
  --request POST \
  --data-binary "@${canary_account_request}" \
  --output /dev/null \
  "${API_URL}/rest/v1/accounts"

OUTPUT_FILE="${canary_ai_request}" OWNER_ID="${owner_c_id}" SECRET_CANARY="${secret_canary}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.OUTPUT_FILE,
  JSON.stringify({
    owner_id: process.env.OWNER_ID,
    provider_name: "setup-e2e-canary",
    api_url: "https://example.invalid/v1",
    api_key: process.env.SECRET_CANARY,
    model_name: "disabled-canary",
    is_active: false,
  }),
  { mode: 0o600 },
);
NODE

curl --config "${setup_curl_config}" \
  --header "Prefer: return=minimal" \
  --request POST \
  --data-binary "@${canary_ai_request}" \
  --output /dev/null \
  "${API_URL}/rest/v1/ai_configs"

FIXTURE_FILE="${setup_runtime_dir}/fixtures.json" \
OWNER_A_EMAIL="${owner_a_email}" OWNER_A_PASSWORD="${owner_a_password}" \
OWNER_B_EMAIL="${owner_b_email}" OWNER_B_PASSWORD="${owner_b_password}" \
OTHER_OWNER_CANARY="${other_owner_canary}" SECRET_CANARY="${secret_canary}" \
  node <<'NODE'
const fs = require("node:fs");

fs.writeFileSync(
  process.env.FIXTURE_FILE,
  JSON.stringify({
    "desktop-chromium": {
      email: process.env.OWNER_A_EMAIL,
      password: process.env.OWNER_A_PASSWORD,
      accountName: "桌面应急储蓄",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
    },
    "mobile-chromium": {
      email: process.env.OWNER_B_EMAIL,
      password: process.env.OWNER_B_PASSWORD,
      accountName: "移动应急储蓄",
      otherOwnerCanary: process.env.OTHER_OWNER_CANARY,
      secretCanary: process.env.SECRET_CANARY,
    },
  }),
  { mode: 0o600 },
);
NODE

# The Next process receives only the local public Supabase boundary. Known
# server-secret names are defined as empty so Next dotenv loading cannot fill
# them from a developer-local file.
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
  pnpm exec next dev --hostname 127.0.0.1 --port "${setup_port}" \
  >"${next_log_file}" 2>&1 &

next_pid="$!"
wait "${next_pid}"
