# Monthly Review Email Reminder Runbook

本 runbook 是 Monthly Review Email Reminder 的 production activation、Cron 和 rollback 唯一操作入口。本文不记录 live 状态。每次操作前必须重新回读 Vercel、Supabase、Resend 和 DNS。

Schema 和 Edge Function 可以先 dark release。App UI 不得在 delivery pipeline 可用前发布。`REVIEW_EMAIL_SENDING_ENABLED` 在全部门禁通过前必须保持 `false`。

Vercel availability gate `REVIEW_EMAIL_FEATURE_ENABLED` 默认保持 `false`。Gate 关闭时，Settings 不读取 reminder RPC、不显示 Email tab，并拒绝 reminder Server Action。数据库 RPC ACL 是权威 availability gate。

## Architecture

`Supabase Cron → send-review-reminders Edge Function → Resend → signed webhook → review_reminder_deliveries`

- Channel 固定为 Email。
- Cron 每 5 分钟运行。
- owner-local 每月 2 日 09:00 后，上一月 Review Completion 仍为空时可以创建一次 delivery。
- Send Commit 后外部请求可能已经开始。此后退订或 Review Completion 不能保证当前 Email 停止。
- Resend API success 只表示 Provider Acceptance。只有签名 webhook 可以表示 delivered、bounced、complained 或 suppressed。

## Required External Inputs

- Resend production credential。
- Resend verified sender domain 或 subdomain。
- 费用与 production delivery 授权。
- Supabase named secret key：`reminder_cron`。

不要把任何 secret 写入本文件、migration、Git、RSC、Client props、delivery ledger 或日志。

## Resend Setup

1. 使用专用发送 subdomain，例如 `notify.example.com`。
2. 完成 SPF、DKIM 和 DMARC readback。
3. 保持 open tracking 和 click tracking 关闭。
4. 创建 send-only API key。
5. 使用 Savings Coach 专用 webhook。禁止把无关产品邮件发送到该 webhook。
6. 创建 webhook，订阅：
   - `email.sent`
   - `email.delivered`
   - `email.delivery_delayed`
   - `email.failed`
   - `email.bounced`
   - `email.complained`
   - `email.suppressed`
7. Webhook URL：
   - `https://PROJECT_REF.supabase.co/functions/v1/resend-review-reminder-webhook`

## Supabase Edge Function Secrets

通过 Supabase Dashboard 写入以下 secret。只回读 key name，不读取 value。

- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `REVIEW_EMAIL_FROM`
- `APP_BASE_URL=https://savings-coach.vercel.app`
- `REVIEW_EMAIL_SENDING_ENABLED=false`

Supabase 默认提供 `SUPABASE_URL` 和 server secret key。禁止把 server secret key放入浏览器或 Cron body。

## Function Deployment

部署以下三个 Function：

- `send-review-reminders`
- `resend-review-reminder-webhook`
- `review-reminder-unsubscribe`

部署后先验证：

- Sender GET 返回 405。
- 无 named secret key 的 Sender POST 返回 401。
- Kill switch 关闭时，合法 Sender POST 返回 503，且 delivery ledger 不改变。
- Webhook 无签名或错误签名返回 400。
- Unsubscribe GET 只显示确认页，不修改 consent。
- Unsubscribe POST 返回空 200，重复请求保持幂等。

## Database Availability Gate

Migration 默认撤销 authenticated 对以下 RPC 的执行权：

- `configure_review_email_reminder(boolean)`
- `get_review_email_reminder_state()`

只在 activation 窗口或正式发布时执行：

```sql
grant execute on function public.configure_review_email_reminder(boolean)
  to authenticated;
grant execute on function public.get_review_email_reminder_state()
  to authenticated;
```

关闭 availability gate：

```sql
revoke execute on function public.configure_review_email_reminder(boolean)
  from authenticated;
revoke execute on function public.get_review_email_reminder_state()
  from authenticated;
```

## Vault

在 Supabase Dashboard 启用 Cron 和 `pg_net`。Vault 只保存 project URL 和 named secret key。

```sql
select vault.create_secret(
  'https://PROJECT_REF.supabase.co',
  'review_reminder_project_url'
);

select vault.create_secret(
  'NAMED_SUPABASE_SECRET_KEY',
  'review_reminder_cron_apikey'
);
```

Single-Owner Activation 结束前不得创建或恢复 Sender Cron。

## Single-Owner Activation

1. 保持 kill switch 为 `false`。
2. 确认 Sender Cron 不存在或已暂停。
3. 创建一个尚未 consent 的 disposable owner。
4. 为该 owner 准备上一月 open Monthly Review。
5. 在受控 activation deployment 中把 Vercel gate 改为 `true`。数据库 gate 仍保持关闭，Email tab 必须保持隐藏。
6. 临时打开数据库 gate。
7. 由 disposable owner 在 Settings 显式 consent。验证 reload 和 unsubscribe GET 确认页。此时不要提交 unsubscribe POST。
8. 回读 consenting eligible owner 数量。结果必须精确等于 1。
9. 将 `REVIEW_EMAIL_SENDING_ENABLED` 改为 `true`。
10. 使用正确 named secret key 手动调用 Sender。错误 key 必须返回 401。
11. 回读 delivery ledger：最多一行，最终状态为 `accepted`，不得为 `cancelled`。
12. 在 Resend Dashboard 回读同一 provider message ID。
13. 使用真实 Resend 签名验证 webhook。早到 webhook 必须先得到非 2xx，重试后才写入 receipt。
14. 收到签名 `email.delivered` 后才称为 delivered。
15. 串行准备新的 disposable review month。分别验证 unsubscribe 和 Review Completion 后，Sender 都不发送。
16. 关闭数据库 gate，并把 Vercel gate 恢复为 `false`。
17. 将 kill switch 恢复为 `false`。
18. 精确清理 disposable owner。回读 consenting eligible owner 数量为 0。
19. 运行 retention dry-run 和 actual readback。

Single-Owner Activation 期间禁止启动 Cron。Sender 会 claim 全部 eligible owner。只靠手动调用不能把全局 Sender 变成单 owner Sender。

## Scheduled Jobs

Single-Owner Activation 全部通过后，创建 Sender Cron：

```sql
select cron.schedule(
  'send-review-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'review_reminder_project_url'
    ) || '/functions/v1/send-review-reminders',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'review_reminder_cron_apikey'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Cron caller 只发送固定空 JSON。禁止传入 owner、Email、月份、subject 或正文。

创建每日 retention job：

```sql
select cron.schedule(
  'purge-review-reminder-deliveries',
  '17 3 * * *',
  $$
  select public.purge_review_reminder_deliveries(current_timestamp, false);
  $$
);
```

数据库 delivery ledger 保留 90 天。Purge 不删除 active lease。Resend 数据保留由 provider 控制。Activation 前必须回读 Resend 当前 retention。若 provider retention 不满足隐私要求，停止 activation。

完成两个 Cron readback 后，按以下顺序正式开放：

1. 启用 sending。
2. 把 Vercel `REVIEW_EMAIL_FEATURE_ENABLED` 改为 `true` 并部署。数据库 gate 仍关闭，Email tab 必须隐藏。
3. 最后打开数据库 gate。
4. 浏览器 reload 后，Email tab 才能出现。

## Metrics Boundaries

- `eligible_review_delivery_created_rate`
- `provider_accepted_rate`
- `provider_delivered_rate`：只使用 webhook evidence。
- `monthly_review_completed_within_7d_of_accepted`
- `unsubscribe_rate`
- `bounce_or_complaint_rate`
- `duplicate_effective_delivery_count`：目标 0。
- `unknown_delivery_rate`

没有 webhook evidence 时，禁止把 accepted 表示为 delivered。没有真实 cohort 时，禁止声称 reminder 提升留存。

## Rollback

1. 立即关闭数据库 gate。
2. 把 `REVIEW_EMAIL_SENDING_ENABLED` 设为 `false`。
3. 把 Vercel `REVIEW_EMAIL_FEATURE_ENABLED` 设为 `false` 并重新部署。
4. 停止 Cron：

```sql
select cron.unschedule('send-review-reminders');
```

5. 轮换或撤销 `reminder_cron` named secret key。
6. 轮换 Resend API key 和 webhook signing secret。
7. delivery ledger 最多保留 90 天用于 reconciliation。禁止盲目重发 unknown delivery。
8. 停止 retention job：

```sql
select cron.unschedule('purge-review-reminder-deliveries');
```
