import assert from "node:assert/strict";
import { buildReviewReminderEmail } from "./reminder-email.ts";

Deno.test("review email has privacy-safe content and unsubscribe headers", () => {
  const email = buildReviewReminderEmail({
    appBaseUrl: "https://app.example.test",
    deliveryId: "11111111-1111-4111-8111-111111111111",
    from: "Savings Coach <review@example.test>",
    recipientEmail: "person@example.test",
    reviewYearMonth: "2026-08",
    supabaseUrl: "https://project.supabase.co",
    unsubscribeToken: "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(email.idempotencyKey, "11111111-1111-4111-8111-111111111111");
  assert.equal(
    email.payload.subject,
    "Your August 2026 Monthly Review is ready",
  );
  assert.equal(
    email.payload.headers["List-Unsubscribe-Post"],
    "List-Unsubscribe=One-Click",
  );
  assert.match(email.payload.headers["List-Unsubscribe"], /^<https:\/\//);
  assert.match(email.payload.text, /Unsubscribe from monthly review reminders/);
  assert.match(email.payload.text, /Sign in to Savings Coach to continue/);
  assert.doesNotMatch(email.payload.text, /Balance Snapshots/);
  assert.match(email.payload.text, /enabled .* reminders in Settings/);
  assert.match(
    email.payload.html,
    />Unsubscribe from monthly review reminders</,
  );
  assert.match(email.payload.html, /display:none/);
  assert.match(email.payload.html, />Open Monthly Review</);
  const content =
    `${email.payload.subject}\n${email.payload.text}\n${email.payload.html}`;
  assert.doesNotMatch(
    content,
    /\$|€|£|¥|\baccount\b|\bamount\b|\btransfer\b|\bpaid\b|\baction name\b/i,
  );
});

Deno.test("review email requires HTTPS except for explicit local hosts", () => {
  const baseInput = {
    appBaseUrl: "http://localhost:3000",
    deliveryId: "11111111-1111-4111-8111-111111111111",
    from: "Savings Coach <review@example.test>",
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
    from: "Savings Coach <review@example.test>",
    recipientEmail: "person@example.test",
    reviewYearMonth: "2026-08",
    supabaseUrl: "https://project.supabase.co",
    unsubscribeToken: "22222222-2222-4222-8222-222222222222",
  };
  assert.throws(
    () =>
      buildReviewReminderEmail({
        ...baseInput,
        from:
          "Savings Coach <review@example.test>\r\nBcc: attacker@example.test",
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
