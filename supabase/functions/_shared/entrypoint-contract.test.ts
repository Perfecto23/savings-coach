import assert from "node:assert/strict";

Deno.test("Edge Function modules export fetch handlers without starting listeners", async () => {
  const [sender, webhook, unsubscribe] = await Promise.all([
    import("../send-review-reminders/index.ts"),
    import("../resend-review-reminder-webhook/index.ts"),
    import("../review-reminder-unsubscribe/index.ts"),
  ]);

  for (const entrypoint of [sender, webhook, unsubscribe]) {
    assert.equal(typeof entrypoint.default?.fetch, "function");
  }
  assert.equal(sender.REMINDER_CRON_SECRET_NAME, "reminder_cron");
});
