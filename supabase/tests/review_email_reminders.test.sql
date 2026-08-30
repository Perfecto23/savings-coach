begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(74);

select has_column('public','owner_setup','review_reminder_enabled_at','Reminder consent exists');
select has_column('public','owner_setup','review_reminder_unsubscribed_at','Reminder unsubscribe audit exists');
select has_column('public','owner_setup','review_reminder_unsubscribe_token','Reminder unsubscribe token exists');
select has_table('public','review_reminder_deliveries','Reminder outbox exists');
select has_column('public','review_reminder_deliveries','scheduled_for','Reminder due timestamp is auditable');
select has_column('public','review_reminder_deliveries','provider_result_ambiguous_at','Ambiguous provider result is auditable');
select is((select confdeltype from pg_constraint where conrelid='public.review_reminder_deliveries'::regclass and confrelid='auth.users'::regclass),'c'::"char",'Outbox cascades during owner teardown');
select is((select count(*) from information_schema.columns where table_schema='public' and table_name='review_reminder_deliveries' and column_name in ('email','recipient_email','body','unsubscribe_token','financial_context')),0::bigint,'Outbox stores no recipient, body, token, or financial context');
select ok(not has_table_privilege('authenticated','public.review_reminder_deliveries','SELECT') and not has_table_privilege('service_role','public.review_reminder_deliveries','SELECT'),'Outbox has no direct authenticated or service table access');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_review_email_reminders_at','claim_review_email_reminders','authorize_review_email_reminder_send','finalize_review_email_reminder','record_review_email_provider_event','purge_review_reminder_deliveries','unsubscribe_review_email_reminder') and has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),7::bigint,'Internal seams are service-role only');
set local role authenticated;
select throws_ok($$select public.configure_review_email_reminder(true)$$,'42501',null,'Database availability gate blocks direct consent writes by default');
select throws_ok($$select public.get_review_email_reminder_state()$$,'42501',null,'Database availability gate blocks direct reminder reads by default');
reset role;
grant execute on function public.configure_review_email_reminder(boolean) to authenticated;
grant execute on function public.get_review_email_reminder_state() to authenticated;

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-4000-8000-00000000011a','authenticated','authenticated','reminder-a@example.invalid',now(),'{}','{}',now(),now()),
('00000000-0000-4000-8000-00000000011b','authenticated','authenticated','reminder-b@example.invalid',null,'{}','{}',now(),now());
insert into public.owner_setup(owner_id,locale,time_zone,base_currency) values
('00000000-0000-4000-8000-00000000011a','en-SG','Asia/Singapore','SGD'),
('00000000-0000-4000-8000-00000000011b','en-US','America/New_York','USD');
insert into public.monthly_milestones(owner_id,year_month,planned_savings,planned_total_savings,status,is_plan_path) values
('00000000-0000-4000-8000-00000000011a','2026-08',100,1000,'on_track',true),
('00000000-0000-4000-8000-00000000011b','2026-08',100,1000,'on_track',true);
insert into public.sop_records(owner_id,year_month,step_key,step_label,due_day,completed,is_monthly_action,rule_amount,scheduled_for,counts_toward_milestone,milestone_amount) values
('00000000-0000-4000-8000-00000000011a','2026-08','reminder_a','Reminder A',1,true,true,100,'2026-08-01',true,100),
('00000000-0000-4000-8000-00000000011b','2026-08','reminder_b','Reminder B',1,true,true,100,'2026-08-01',true,100);

set local role authenticated; set local "request.jwt.claim.sub"='00000000-0000-4000-8000-00000000011a'; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-00000000011a","role":"authenticated"}';
select is((public.configure_review_email_reminder(true)->>'enabled')::boolean,true,'Confirmed owner enables reminder');
select is((public.get_review_email_reminder_state()->>'schedule_day') || '|' || (public.get_review_email_reminder_state()->>'schedule_local_time'),'2|09:00:00','State exposes fixed day2 09:00 schedule');
select is((select string_agg(key,',' order by key) from jsonb_object_keys(public.get_review_email_reminder_state()) key),'enabled,schedule_day,schedule_local_time','Reminder state exposes only the frontend key allowlist');
select throws_ok($$update public.owner_setup set review_reminder_enabled_at=now() where owner_id='00000000-0000-4000-8000-00000000011a'$$,'42501',null,'Direct consent writes are closed');

reset role; set local role authenticated; set local "request.jwt.claim.sub"='00000000-0000-4000-8000-00000000011b'; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-00000000011b","role":"authenticated"}';
select ok((public.configure_review_email_reminder(false)->>'enabled')::boolean = false and (select review_reminder_unsubscribed_at is null from public.owner_setup where owner_id='00000000-0000-4000-8000-00000000011b'),'Default-disabled unsubscribe is idempotent and writes no audit timestamp');
select throws_ok($$select public.configure_review_email_reminder(true)$$,'P0001','confirmed_email_required','Unconfirmed email cannot consent');

reset role; set local role service_role;
select is(jsonb_array_length(public.claim_review_email_reminders_at('2026-09-02 00:59:59+00',10)),0,'Before 09:00 owner-local no delivery claims');
create temporary table first_claim as select public.claim_review_email_reminders_at('2026-09-02 01:00:00+00',10) payload;
select is((select jsonb_array_length(payload) from first_claim),1,'At 09:00 one due delivery claims');
reset role;
select results_eq($$select status,attempt_count,scheduled_for from public.review_reminder_deliveries$$,$$values('claimed'::text,1,'2026-09-02 01:00:00+00'::timestamptz)$$,'Claim stores lease attempt and due timestamp');
set local role service_role;
select is(jsonb_array_length(public.claim_review_email_reminders_at('2026-09-02 01:00:01+00',10)),0,'Concurrent repeat cannot claim active lease');

create temporary table authorized as select public.authorize_review_email_reminder_send((payload->0->>'delivery_id')::uuid,(payload->0->>'claim_token')::uuid) payload from first_claim;
select is((select (payload->>'authorized') || '|' || (payload->>'recipient_email') || '|' || (payload->>'review_year_month') from authorized),'true|reminder-a@example.invalid|2026-08','Authorize returns minimal internal recipient job');
reset role;
select is((select status from public.review_reminder_deliveries),'sending','Authorization commits the sending boundary');
set local role authenticated; set local "request.jwt.claim.sub"='00000000-0000-4000-8000-00000000011a'; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-00000000011a","role":"authenticated"}';
select is(public.configure_review_email_reminder(false)->>'enabled','false','Unsubscribe succeeds while send is in flight');
reset role;
select is((select status from public.review_reminder_deliveries),'sending','Unsubscribe does not cancel sending');
set local role service_role;
select is((select public.finalize_review_email_reminder((f.payload->0->>'delivery_id')::uuid,(f.payload->0->>'claim_token')::uuid,'accepted','email_abc123',null,null)->>'status' from first_claim f),'accepted','Provider API receipt becomes accepted, not delivered');
reset role;
select is((select status || '|' || coalesce(delivered_at::text,'NULL') from public.review_reminder_deliveries),'accepted|NULL','Accepted remains distinct from delivered');
set local role service_role;
select is(public.record_review_email_provider_event('email_abc123','evt_abc123','email.delivered','2026-09-02 01:01:00+00')->>'status','delivered','Verified provider delivery event marks delivered');
reset role;
select is((select status || '|' || to_char(delivered_at at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') from public.review_reminder_deliveries),'delivered|2026-09-02 01:01:00','Provider receipt timestamp persists');
set local role service_role;
select is(public.record_review_email_provider_event('email_abc123','evt_abc123','email.delivered','2026-09-02 01:01:00+00')->>'status','delivered','Duplicate provider event is idempotent');
select is(public.record_review_email_provider_event('email_missing','evt_missing','email.delivered','2026-09-02 01:01:00+00')->>'matched','false','Unknown provider message returns matched false');
reset role;
select is((select count(*) from public.review_reminder_deliveries where owner_id='00000000-0000-4000-8000-00000000011b'),0::bigint,'A/B isolation creates no unconfirmed-owner delivery');

reset role; set local role authenticated; set local "request.jwt.claim.sub"='00000000-0000-4000-8000-00000000011a'; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-00000000011a","role":"authenticated"}';
select is(public.configure_review_email_reminder(false)->>'enabled','false','Owner unsubscribes immediately');
select is((public.get_review_email_reminder_state()->>'enabled')::boolean,false,'Safe state reflects unsubscribe');

reset role;
insert into public.review_reminder_deliveries (
  owner_id, review_year_month, status, scheduled_for, provider_message_id,
  provider_accepted_at, provider_event_id, provider_event_at, delivered_at, terminal_at
) values
('00000000-0000-4000-8000-00000000011b','2026-01','complained','2026-01-02+00','email_precedence_complained_failed','2026-08-31+00','evt_precedence_complained','2026-09-01+00',null,'2026-09-01+00'),
('00000000-0000-4000-8000-00000000011b','2026-02','bounced','2026-02-02+00','email_precedence_bounced_failed','2026-08-31+00','evt_precedence_bounced','2026-09-01+00',null,'2026-09-01+00'),
('00000000-0000-4000-8000-00000000011b','2026-03','suppressed','2026-03-02+00','email_precedence_suppressed_failed','2026-08-31+00','evt_precedence_suppressed','2026-09-01+00',null,'2026-09-01+00'),
('00000000-0000-4000-8000-00000000011b','2026-04','failed','2026-04-02+00','email_precedence_failed_delivered','2026-08-31+00','evt_precedence_failed','2026-09-01+00',null,'2026-09-01+00'),
('00000000-0000-4000-8000-00000000011b','2026-05','delivered','2026-05-02+00','email_precedence_delivered_complained','2026-08-31+00','evt_precedence_delivered','2026-09-01+00','2026-09-01+00',null),
('00000000-0000-4000-8000-00000000011b','2026-06','accepted','2026-06-02+00','email_precedence_old_terminal','2026-08-31+00','evt_precedence_newer','2026-09-03+00',null,null),
('00000000-0000-4000-8000-00000000011b','2026-07','delivered','2026-07-02+00','email_precedence_equal_timestamp','2026-08-31+00','evt_precedence_equal_delivered','2026-09-02+00','2026-09-02+00',null),
('00000000-0000-4000-8000-00000000011b','2026-09','accepted','2026-09-02+00','email_precedence_accepted_bounced','2026-08-31+00','evt_precedence_accepted','2026-09-01+00',null,null);
set local role service_role;
select is(public.record_review_email_provider_event('email_precedence_complained_failed','evt_precedence_failed_1','email.failed','2026-09-02+00')->>'status','complained','Failed cannot override complained');
select is(public.record_review_email_provider_event('email_precedence_bounced_failed','evt_precedence_failed_2','email.failed','2026-09-02+00')->>'status','bounced','Failed cannot override bounced');
select is(public.record_review_email_provider_event('email_precedence_suppressed_failed','evt_precedence_failed_3','email.failed','2026-09-02+00')->>'status','suppressed','Failed cannot override suppressed');
select is(public.record_review_email_provider_event('email_precedence_failed_delivered','evt_precedence_delivered','email.delivered','2026-09-02+00')->>'status','delivered','Delivered overrides failed');
reset role;
select is((select status || '|' || coalesce(terminal_at::text,'NULL') from public.review_reminder_deliveries where provider_message_id='email_precedence_failed_delivered'),'delivered|NULL','Delivered clears superseded terminal timestamp');
set local role service_role;
select is(public.record_review_email_provider_event('email_precedence_delivered_complained','evt_precedence_complained_2','email.complained','2026-09-02+00')->>'status','complained','Complaint overrides delivered');
select is(public.record_review_email_provider_event('email_precedence_old_terminal','evt_precedence_older_terminal','email.bounced','2026-09-02+00')->>'status','accepted','Older terminal event is ignored');
reset role;
select is((select provider_event_id from public.review_reminder_deliveries where provider_message_id='email_precedence_old_terminal'),'evt_precedence_newer','Older terminal does not replace receipt');
set local role service_role;
select is(public.record_review_email_provider_event('email_precedence_equal_timestamp','evt_precedence_equal_complained','email.complained','2026-09-02+00')->>'status','complained','Equal timestamp uses fixed event priority');
select is(public.record_review_email_provider_event('email_precedence_accepted_bounced','evt_precedence_bounced_2','email.bounced','2026-09-02+00')->>'status','bounced','Negative terminal overrides accepted');

reset role;
insert into public.review_reminder_deliveries (
  id, owner_id, review_year_month, status, scheduled_for, attempt_count,
  first_attempt_at, claimed_at, claim_expires_at, claim_token
) values (
  '00000000-0000-4000-8000-00000000016a',
  '00000000-0000-4000-8000-00000000011a',
  '2026-10', 'sending', '2026-09-02 01:00:00+00', 1,
  '2026-09-02 01:00:00+00', '2026-09-02 01:00:00+00',
  '2026-09-02 01:05:00+00', '00000000-0000-4000-8000-00000000016b'
);
set local role service_role;
create temporary table recovered_sending as
select public.claim_review_email_reminders_at('2026-09-02 01:05:01+00',10) payload;
select is((select jsonb_array_length(payload) from recovered_sending),1,'Expired sending lease is recovered');
reset role;
select is(
  (select status || '|' || attempt_count || '|' || (provider_result_ambiguous_at is not null)::text from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000016a'),
  'sending|2|true',
  'Recovered sending remains committed and records ambiguity'
);
set local role service_role;
select is(
  (select public.authorize_review_email_reminder_send(
    '00000000-0000-4000-8000-00000000016a',
    (payload->0->>'claim_token')::uuid
  )->>'authorized' from recovered_sending),
  'true',
  'Recovered sending bypasses a later consent change'
);
reset role; set local role authenticated; set local "request.jwt.claim.sub"='00000000-0000-4000-8000-00000000011a'; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-00000000011a","role":"authenticated"}';
select is(public.configure_review_email_reminder(false)->>'enabled','false','Unsubscribe remains idempotent during recovery');
reset role;
select is((select status from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000016a'),'sending','Unsubscribe cannot mislabel committed recovery as cancelled');
set local role service_role;
select is(
  (select public.finalize_review_email_reminder(
    '00000000-0000-4000-8000-00000000016a',
    (payload->0->>'claim_token')::uuid,
    'ambiguous_retry', null, 'resend_network_error',
    '2026-09-02 01:10:01+00'
  )->>'status' from recovered_sending),
  'sending',
  'Ambiguous result stays on the committed sending path'
);
reset role;
select is(
  (select status || '|' || to_char(next_attempt_at at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') || '|' || (provider_result_ambiguous_at is not null)::text || '|' || (claim_token is null)::text from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000016a'),
  'sending|2026-09-02 01:10:01|true|true',
  'Ambiguous retry releases the lease without reopening cancellation'
);
set local role service_role;
select is(jsonb_array_length(public.claim_review_email_reminders_at('2026-09-02 01:10:00+00',10)),0,'Committed retry waits until next attempt');
create temporary table second_recovery as
select public.claim_review_email_reminders_at('2026-09-02 01:10:01+00',10) payload;
select is((select jsonb_array_length(payload) from second_recovery),1,'Committed retry reuses the same delivery');
select is(
  (select public.finalize_review_email_reminder(
    '00000000-0000-4000-8000-00000000016a',
    (payload->0->>'claim_token')::uuid,
    'failed', null, 'resend_invalid_idempotent_request', null
  )->>'status' from second_recovery),
  'unknown',
  'Definitive retry failure cannot erase an earlier ambiguous attempt'
);
reset role;
select is((select status from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000016a'),'unknown','Recovered ambiguity ends as unknown, not failed or cancelled');

insert into public.review_reminder_deliveries (
  id, owner_id, review_year_month, status, scheduled_for, attempt_count,
  first_attempt_at, provider_result_ambiguous_at, claimed_at,
  claim_expires_at, claim_token
) values (
  '00000000-0000-4000-8000-00000000018a',
  '00000000-0000-4000-8000-00000000011a',
  '2026-12', 'sending', '2026-09-02 01:00:00+00', 2,
  '2026-09-02 01:00:00+00', '2026-09-02 01:01:00+00',
  '2026-09-02 01:05:00+00', '2026-09-02 01:10:00+00',
  '00000000-0000-4000-8000-00000000018b'
);
set local role service_role;
select is(
  public.finalize_review_email_reminder(
    '00000000-0000-4000-8000-00000000018a',
    '00000000-0000-4000-8000-00000000018b',
    'retry_wait', null, 'resend_rate_limit_exceeded',
    '2026-09-02 01:15:01+00'
  )->>'status',
  'sending',
  'Later 429 cannot clear an earlier ambiguous result'
);
reset role;
select is(
  (select status || '|' || (provider_result_ambiguous_at is not null)::text from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000018a'),
  'sending|true',
  'Ambiguous marker stays non-cancellable after a later definitive retry'
);
set local role service_role;
create temporary table post_ambiguous_rate_limit as
select public.claim_review_email_reminders_at('2026-09-02 01:15:01+00',10) payload;
select is((select jsonb_array_length(payload) from post_ambiguous_rate_limit),1,'Ambiguous delivery retries after the later rate limit');
select is(
  (select public.finalize_review_email_reminder(
    '00000000-0000-4000-8000-00000000018a',
    (payload->0->>'claim_token')::uuid,
    'failed', null, 'resend_invalid_idempotent_request', null
  )->>'status' from post_ambiguous_rate_limit),
  'unknown',
  'Later definitive failure cannot erase an earlier ambiguous result'
);
reset role;

insert into public.review_reminder_deliveries (
  id, owner_id, review_year_month, status, scheduled_for, attempt_count,
  first_attempt_at, claimed_at, claim_expires_at, claim_token
) values (
  '00000000-0000-4000-8000-00000000017a',
  '00000000-0000-4000-8000-00000000011a',
  '2026-11', 'sending', '2026-09-02 01:00:00+00', 1,
  '2026-09-02 01:00:00+00', '2026-09-02 01:00:00+00',
  '2026-09-02 01:05:00+00', '00000000-0000-4000-8000-00000000017b'
);
set local role service_role;
select is(
  public.finalize_review_email_reminder(
    '00000000-0000-4000-8000-00000000017a',
    '00000000-0000-4000-8000-00000000017b',
    'retry_wait', null, 'resend_rate_limit_exceeded',
    '2026-09-02 01:10:01+00'
  )->>'status',
  'retry_wait',
  'Definitive provider rejection returns to cancellable retry'
);
reset role;
select is((select status || '|' || (provider_result_ambiguous_at is null)::text from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000017a'),'retry_wait|true','Definitive retry has no ambiguous result marker');
set local role authenticated; set local "request.jwt.claim.sub"='00000000-0000-4000-8000-00000000011a'; set local "request.jwt.claim.role"='authenticated'; set local "request.jwt.claims"='{"sub":"00000000-0000-4000-8000-00000000011a","role":"authenticated"}';
select is(public.configure_review_email_reminder(false)->>'enabled','false','Unsubscribe handles definitive retry');
reset role;
select is((select status from public.review_reminder_deliveries where id='00000000-0000-4000-8000-00000000017a'),'cancelled','Unsubscribe cancels a definitive retry before the next dispatch');

select ok(
  has_function_privilege('service_role','public.purge_review_reminder_deliveries(timestamptz,boolean)','EXECUTE')
  and not has_function_privilege('authenticated','public.purge_review_reminder_deliveries(timestamptz,boolean)','EXECUTE')
  and not has_function_privilege('anon','public.purge_review_reminder_deliveries(timestamptz,boolean)','EXECUTE'),
  'Retention purge RPC is service-role only'
);
reset role; set local role authenticated;
select throws_ok($$select public.purge_review_reminder_deliveries('2026-08-31+00',true)$$,'42501',null,'Authenticated cannot invoke retention purge');
reset role;
insert into public.review_reminder_deliveries (
  owner_id, review_year_month, status, scheduled_for, provider_message_id,
  provider_accepted_at, delivered_at, terminal_at, created_at, updated_at,
  claimed_at, claim_expires_at, claim_token
) values
('00000000-0000-4000-8000-00000000011b','2025-01','accepted','2025-01-02+00','email_retention_accepted','2026-05-01+00',null,null,'2026-05-01+00','2026-05-01+00',null,null,null),
('00000000-0000-4000-8000-00000000011b','2025-02','unknown','2025-02-02+00',null,null,null,'2026-05-01+00','2026-05-01+00','2026-05-01+00',null,null,null),
('00000000-0000-4000-8000-00000000011b','2025-03','bounced','2025-03-02+00','email_retention_bounced','2026-04-01+00',null,'2026-05-01+00','2026-05-01+00','2026-05-01+00',null,null,null),
('00000000-0000-4000-8000-00000000011b','2025-04','delivered','2025-04-02+00','email_retention_delivered','2026-04-01+00','2026-05-01+00',null,'2026-05-01+00','2026-05-01+00',null,null,null),
('00000000-0000-4000-8000-00000000011b','2025-05','claimed','2025-05-02+00',null,null,null,null,'2026-05-01+00','2026-05-01+00','2026-05-01+00','2026-09-01+00','00000000-0000-4000-8000-00000000015a'),
('00000000-0000-4000-8000-00000000011b','2025-06','accepted','2025-06-02+00','email_retention_recent','2026-08-30+00',null,null,'2026-08-30+00','2026-08-30+00',null,null,null);
set local role service_role;
select is((public.purge_review_reminder_deliveries('2026-08-31+00',true)->>'candidate_count')::integer,4,'Retention dry-run finds four expired rows');
select is((public.purge_review_reminder_deliveries('2026-08-31+00',true)->>'deleted_count')::integer,0,'Retention dry-run does not delete');
select is((public.purge_review_reminder_deliveries('2026-08-31+00',false)->>'deleted_count')::integer,4,'Retention actual purge deletes expired rows');
reset role;
select is((select count(*) from public.review_reminder_deliveries where review_year_month in ('2025-01','2025-02','2025-03','2025-04')),0::bigint,'Expired accepted, unknown and terminal rows are removed');
select is((select status || '|' || claim_expires_at::text from public.review_reminder_deliveries where review_year_month='2025-05'),'claimed|2026-09-01 00:00:00+00','Active lease survives retention purge');
select is((select count(*) from public.review_reminder_deliveries where review_year_month='2025-06'),1::bigint,'Recent accepted row survives retention purge');

reset role;
select throws_ok($$update public.review_reminder_deliveries set provider_message_id=repeat('x',129)$$,'23514',null,'Provider message IDs are bounded');
select throws_ok($$update public.review_reminder_deliveries set last_error_code='Raw provider error!'$$,'23514',null,'Raw provider errors cannot persist');
select * from finish(); rollback;
