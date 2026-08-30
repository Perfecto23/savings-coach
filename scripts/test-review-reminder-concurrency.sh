#!/usr/bin/env bash
set -euo pipefail
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OWNER="00000000-0000-4000-8000-00000000011c"
REVIEW_OWNER="00000000-0000-4000-8000-00000000011d"
CANCEL_OWNER="00000000-0000-4000-8000-00000000011e"
TMP="$(mktemp -d)"
cleanup(){ set +e; rm -r -- "$TMP"; pnpm exec supabase db reset --no-seed >/dev/null 2>&1; }
trap cleanup EXIT
sql(){ psql "$DB_URL" -v ON_ERROR_STOP=1 -qAtc "$1"; }
as_role(){ local role="$1" sub="$2" q="$3"; psql "$DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL
begin; set local role $role;
set local "request.jwt.claim.sub"='$sub'; set local "request.jwt.claim.role"='$role';
set local "request.jwt.claims"='{"sub":"$sub","role":"$role"}'; select pg_sleep(0.25); $q commit;
SQL
}
pnpm exec supabase db reset --no-seed >/dev/null
sql "insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('$OWNER','authenticated','authenticated','concurrent-reminder@example.invalid',now(),'{}','{}',now(),now()),('$REVIEW_OWNER','authenticated','authenticated','concurrent-review@example.invalid',now(),'{}','{}',now(),now()),('$CANCEL_OWNER','authenticated','authenticated','cancel-reminder@example.invalid',now(),'{}','{}',now(),now()); insert into public.owner_setup(owner_id,locale,time_zone,base_currency) values('$OWNER','en-SG','Asia/Singapore','SGD'),('$REVIEW_OWNER','en-SG','Asia/Singapore','SGD'),('$CANCEL_OWNER','en-SG','Asia/Singapore','SGD'); insert into public.monthly_milestones(owner_id,year_month,planned_savings,planned_total_savings,status,is_plan_path) values('$OWNER','2026-08',1,1,'pending',true),('$REVIEW_OWNER','2026-08',1,1,'pending',true),('$CANCEL_OWNER','2026-08',1,1,'pending',true); insert into public.sop_records(owner_id,year_month,step_key,step_label,due_day,is_monthly_action,rule_amount,scheduled_for,counts_toward_milestone,milestone_amount) values('$OWNER','2026-08','r','R',1,true,1,'2026-08-01',true,1),('$REVIEW_OWNER','2026-08','rr','RR',1,true,1,'2026-08-01',true,1),('$CANCEL_OWNER','2026-08','rc','RC',1,true,1,'2026-08-01',true,1);"
sql "grant execute on function public.configure_review_email_reminder(boolean) to authenticated; grant execute on function public.get_review_email_reminder_state() to authenticated;"
as_role authenticated "$OWNER" "select public.configure_review_email_reminder(true);" >/dev/null
as_role authenticated "$REVIEW_OWNER" "select public.configure_review_email_reminder(true);" >/dev/null
set +e
as_role service_role "$OWNER" "select public.claim_review_email_reminders_at('2026-09-02 01:00:00+00',10);" >"$TMP/a" 2>&1 & a=$!
as_role service_role "$OWNER" "select public.claim_review_email_reminders_at('2026-09-02 01:00:00+00',10);" >"$TMP/b" 2>&1 & b=$!
wait "$a"; sa=$?; wait "$b"; sb=$?; set -e
[[ $sa -eq 0 && $sb -eq 0 ]] || { echo "FAIL duplicate claim $sa/$sb"; exit 1; }
[[ "$(sql "select count(*) from public.review_reminder_deliveries where owner_id='$OWNER' and status='claimed' and attempt_count=1;")" == 1 ]] || { echo 'FAIL one lease'; exit 1; }
ID="$(sql "select id from public.review_reminder_deliveries where owner_id='$OWNER';")"; TOKEN="$(sql "select claim_token from public.review_reminder_deliveries where id='$ID';")"
as_role service_role "$OWNER" "select public.authorize_review_email_reminder_send('$ID','$TOKEN');" >"$TMP/auth" 2>&1
[[ "$(sql "select status from public.review_reminder_deliveries where id='$ID';")" == sending ]] || { echo 'FAIL send commit'; exit 1; }
as_role authenticated "$OWNER" "select public.configure_review_email_reminder(false);" >"$TMP/unsub" 2>&1
[[ "$(sql "select (review_reminder_enabled_at is null)::int from public.owner_setup where owner_id='$OWNER';")" == 1 ]] || exit 1
[[ "$(sql "select status from public.review_reminder_deliveries where id='$ID';")" == sending ]] || { echo 'FAIL committed send cancelled'; exit 1; }
as_role service_role "$OWNER" "select public.finalize_review_email_reminder('$ID','$TOKEN','accepted','email_concurrency_main',null,null);" >/dev/null
[[ "$(sql "select status from public.review_reminder_deliveries where id='$ID';")" == accepted ]] || { echo 'FAIL committed send finalization'; exit 1; }
echo "PASS send commit survives later unsubscribe"

as_role authenticated "$CANCEL_OWNER" "select public.configure_review_email_reminder(true);" >/dev/null
as_role service_role "$CANCEL_OWNER" "select public.claim_review_email_reminders_at('2026-09-02 01:00:00+00',10);" >/dev/null
CANCEL_ID="$(sql "select id from public.review_reminder_deliveries where owner_id='$CANCEL_OWNER';")"
CANCEL_TOKEN="$(sql "select claim_token from public.review_reminder_deliveries where id='$CANCEL_ID';")"
as_role authenticated "$CANCEL_OWNER" "select public.configure_review_email_reminder(false);" >/dev/null
set +e
as_role service_role "$CANCEL_OWNER" "select public.authorize_review_email_reminder_send('$CANCEL_ID','$CANCEL_TOKEN');" >"$TMP/cancel-auth" 2>&1
cancel_status=$?
set -e
[[ $cancel_status -ne 0 ]] || { echo 'FAIL cancelled claim authorized'; exit 1; }
[[ "$(sql "select status from public.review_reminder_deliveries where id='$CANCEL_ID';")" == cancelled ]] || { echo 'FAIL pre-commit unsubscribe'; exit 1; }
echo "PASS unsubscribe before send commit prevents authorization"

set +e
as_role service_role "$REVIEW_OWNER" "select public.claim_review_email_reminders_at('2026-09-02 01:00:00+00',10);" >"$TMP/review-claim" 2>&1 & a=$!
psql "$DB_URL" -v ON_ERROR_STOP=1 -qAt <<SQL >"$TMP/review-complete" 2>&1 &
begin;
select pg_sleep(0.25);
update public.monthly_milestones
set review_completed_at = '2026-09-02 01:00:00+00', status = 'on_track'
where owner_id = '$REVIEW_OWNER' and year_month = '2026-08';
commit;
SQL
b=$!
wait "$a"; sa=$?; wait "$b"; sb=$?; set -e
[[ $sa -eq 0 && $sb -eq 0 ]] || { echo "FAIL claim/review completion $sa/$sb"; exit 1; }
[[ "$(sql "select count(*) from public.review_reminder_deliveries where owner_id='$REVIEW_OWNER' and status in ('pending','claimed','retry_wait','accepted');")" == 0 ]] || { echo 'FAIL active delivery survived Review Completion'; exit 1; }
[[ "$(sql "select count(*) from public.review_reminder_deliveries where owner_id='$REVIEW_OWNER' and status <> 'cancelled';")" == 0 ]] || { echo 'FAIL non-cancelled delivery survived'; exit 1; }
echo "PASS claim vs Review Completion has no sendable delivery"
