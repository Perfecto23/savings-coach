import assert from "node:assert/strict";
import { signSvixPayloadForTest, verifySvixSignature } from "./svix.ts";

const secret = `whsec_${btoa("test-webhook-secret-32-bytes-long")}`;
const now = new Date("2026-08-31T12:00:00.000Z");
const timestamp = Math.floor(now.getTime() / 1000);
const payload = '{"type":"email.delivered"}';

Deno.test("Svix verification uses the raw body and rejects tampering", async () => {
  const signature = await signSvixPayloadForTest({
    id: "event_123",
    payload,
    secret,
    timestamp,
  });
  const headers = {
    id: "event_123",
    signature,
    timestamp: String(timestamp),
  };
  assert.equal(
    await verifySvixSignature({ headers, now, payload, secret }),
    true,
  );
  assert.equal(
    await verifySvixSignature({
      headers,
      now,
      payload: `${payload} `,
      secret,
    }),
    false,
  );
});

Deno.test("Svix verification rejects replayed timestamps", async () => {
  const staleTimestamp = timestamp - 301;
  const signature = await signSvixPayloadForTest({
    id: "event_stale",
    payload,
    secret,
    timestamp: staleTimestamp,
  });
  assert.equal(
    await verifySvixSignature({
      headers: {
        id: "event_stale",
        signature,
        timestamp: String(staleTimestamp),
      },
      now,
      payload,
      secret,
    }),
    false,
  );
});
