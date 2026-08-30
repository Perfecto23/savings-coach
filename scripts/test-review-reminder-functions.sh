#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

env \
  -u APP_BASE_URL \
  -u RESEND_API_KEY \
  -u RESEND_WEBHOOK_SECRET \
  -u REVIEW_EMAIL_FROM \
  -u REVIEW_EMAIL_SENDING_ENABLED \
  deno test \
    --no-config \
    --lock=supabase/functions/deno.lock \
    --frozen \
    supabase/functions

deno check \
  --no-config \
  --lock=supabase/functions/deno.lock \
  --frozen \
  --node-modules-dir=auto \
  supabase/functions/send-review-reminders/index.ts \
  supabase/functions/resend-review-reminder-webhook/index.ts \
  supabase/functions/review-reminder-unsubscribe/index.ts

for function_name in \
  send-review-reminders \
  resend-review-reminder-webhook \
  review-reminder-unsubscribe
do
  if ! awk -v section="[functions.${function_name}]" '
    $0 == section { in_section = 1; next }
    in_section && /^\[/ { exit }
    in_section && $0 == "verify_jwt = false" { found = 1 }
    END { exit found ? 0 : 1 }
  ' supabase/config.toml
  then
    echo "Missing verify_jwt=false for ${function_name}" >&2
    exit 1
  fi
done
