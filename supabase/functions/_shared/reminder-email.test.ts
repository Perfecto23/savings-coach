import assert from "node:assert/strict";
import { buildReviewReminderEmail } from "./reminder-email.ts";

Deno.test("review email has privacy-safe content and unsubscribe headers", () => {
  const email = buildReviewReminderEmail({
    appBaseUrl: "https://app.example.test",
    deliveryId: "11111111-1111-4111-8111-111111111111",
    from: "储蓄教练 <review@example.test>",
    recipientEmail: "person@example.test",
    reviewYearMonth: "2026-08",
    supabaseUrl: "https://project.supabase.co",
    unsubscribeToken: "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(email.idempotencyKey, "11111111-1111-4111-8111-111111111111");
  assert.equal(
    email.payload.subject,
    "请完成 2026年8月月度复盘",
  );
  assert.equal(
    email.payload.headers["List-Unsubscribe-Post"],
    "List-Unsubscribe=One-Click",
  );
  assert.match(email.payload.headers["List-Unsubscribe"], /^<https:\/\//);
  assert.match(email.payload.text, /退订月度复盘邮件提醒/);
  assert.match(email.payload.text, /登录储蓄教练，完成月度复盘/);
  assert.doesNotMatch(email.payload.text, /Balance Snapshots/);
  assert.match(email.payload.text, /已在设置中启用月度复盘邮件提醒/);
  assert.match(
    email.payload.html,
    />退订月度复盘邮件提醒</,
  );
  assert.match(email.payload.html, /display:none/);
  assert.match(email.payload.html, /<html lang="zh-CN">/);
  assert.match(email.payload.html, />打开月度复盘</);
  const content =
    `${email.payload.subject}\n${email.payload.text}\n${email.payload.html}`;
  assert.doesNotMatch(
    content,
    /\$|€|£|¥|\baccount\b|\bamount\b|\btransfer\b|\bpaid\b|\baction name\b|账户|余额|金额|转账|付费|月度行动/,
  );
});

Deno.test("review email requires HTTPS except for explicit local hosts", () => {
  const baseInput = {
    appBaseUrl: "http://localhost:3000",
    deliveryId: "11111111-1111-4111-8111-111111111111",
    from: "储蓄教练 <review@example.test>",
    recipientEmail: "person@example.test",
    reviewYearMonth: "2026-08",
    supabaseUrl: "http://127.0.0.1:54321",
    unsubscribeToken: "22222222-2222-4222-8222-222222222222",
  };
  assert.doesNotThrow(() => buildReviewReminderEmail(baseInput));
  assert.throws(
    () =>
      buildReviewReminderEmail({
        ...baseInput,
        appBaseUrl: "http://app.example.test",
      }),
    /app_base_url_invalid/,
  );
  assert.throws(
    () =>
      buildReviewReminderEmail({
        ...baseInput,
        supabaseUrl: "http://project.example.test",
      }),
    /supabase_url_invalid/,
  );
});

Deno.test("review email rejects malformed and CRLF-injected addresses", () => {
  const baseInput = {
    appBaseUrl: "https://app.example.test",
    deliveryId: "11111111-1111-4111-8111-111111111111",
    from: "储蓄教练 <review@example.test>",
    recipientEmail: "person@example.test",
    reviewYearMonth: "2026-08",
    supabaseUrl: "https://project.supabase.co",
    unsubscribeToken: "22222222-2222-4222-8222-222222222222",
  };
  assert.throws(
    () =>
      buildReviewReminderEmail({
        ...baseInput,
        from: "储蓄教练 <review@example.test>\r\nBcc: attacker@example.test",
      }),
    /from_invalid/,
  );
  assert.throws(
    () =>
      buildReviewReminderEmail({
        ...baseInput,
        recipientEmail: "person@example.test\nBcc: attacker@example.test",
      }),
    /recipient_email_invalid/,
  );
  assert.throws(
    () => buildReviewReminderEmail({ ...baseInput, recipientEmail: "invalid" }),
    /recipient_email_invalid/,
  );
});
