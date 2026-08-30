import assert from "node:assert/strict";
import type { ReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import { signSvixPayloadForTest } from "../_shared/svix.ts";
import { handleResendWebhook } from "./handler.ts";

const secret = `whsec_${btoa("test-webhook-secret-32-bytes-long")}`;
const now = new Date("2026-08-31T12:00:00.000Z");
const timestamp = Math.floor(now.getTime() / 1000);

function gateway(recorded: unknown[], matched = true): ReminderRpcGateway {
  return {
    claim: async () => [],
    authorize: async () => null,
    finalize: async () => {},
    recordProviderEvent: async (value: unknown) => {
      recorded.push(value);
      return matched;
    },
    unsubscribe: async () => {},
  } as ReminderRpcGateway;
}

function streamingRequest(
  chunks: Uint8Array[],
  headers: HeadersInit = {},
): { request: Request; wasCancelled: () => boolean } {
  let index = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (!chunk) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    request: new Request("https://example.test", {
      method: "POST",
      headers,
      body: stream,
    }),
    wasCancelled: () => cancelled,
  };
}

async function signedRequest(
  payload: string,
  id = "event_123",
): Promise<Request> {
  const signature = await signSvixPayloadForTest({
    id,
    payload,
    secret,
    timestamp,
  });
  return new Request("https://example.test", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-signature": signature,
      "svix-timestamp": String(timestamp),
    },
    body: payload,
  });
}

Deno.test("webhook verifies signature and accepts duplicate event delivery", async () => {
  const recorded: unknown[] = [];
  const payload = JSON.stringify({
    type: "email.delivered",
    created_at: now.toISOString(),
    data: { email_id: "provider-message-id", to: ["private@example.test"] },
  });
  for (let index = 0; index < 2; index += 1) {
    const response = await handleResendWebhook(
      await signedRequest(payload),
      { gateway: gateway(recorded), now: () => now, webhookSecret: secret },
    );
    assert.equal(response.status, 200);
  }
  assert.equal(recorded.length, 2);
  assert.deepEqual(recorded[0], {
    eventId: "event_123",
    eventType: "email.delivered",
    occurredAt: now.toISOString(),
    providerMessageId: "provider-message-id",
  });
});

Deno.test("webhook returns 503 when a signed allowed event arrives before acceptance", async () => {
  const recorded: unknown[] = [];
  const payload = JSON.stringify({
    type: "email.delivered",
    created_at: now.toISOString(),
    data: { email_id: "provider-message-id" },
  });
  const response = await handleResendWebhook(
    await signedRequest(payload),
    {
      gateway: gateway(recorded, false),
      now: () => now,
      webhookSecret: secret,
    },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "provider_event_not_ready",
      message: "Provider event is not ready.",
    },
  });
  assert.equal(recorded.length, 1);
});

Deno.test("webhook rejects a body over 64 KiB from Content-Length before reading it", async () => {
  const recorded: unknown[] = [];
  const response = await handleResendWebhook(
    new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": String(64 * 1024 + 1) },
      body: "{}",
    }),
    { gateway: gateway(recorded), now: () => now, webhookSecret: secret },
  );
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: {
      code: "request_body_too_large",
      message: "Request body is too large.",
    },
  });
  assert.equal(recorded.length, 0);
});

Deno.test("webhook stops a chunked body over 64 KiB without Content-Length", async () => {
  const recorded: unknown[] = [];
  const { request, wasCancelled } = streamingRequest([
    new Uint8Array(64 * 1024),
    new Uint8Array([0]),
  ]);
  const response = await handleResendWebhook(
    request,
    { gateway: gateway(recorded), now: () => now, webhookSecret: secret },
  );
  assert.equal(response.status, 413);
  assert.equal(wasCancelled(), true);
  assert.equal(recorded.length, 0);
});

Deno.test("webhook rejects a changed raw body", async () => {
  const original = JSON.stringify({
    type: "email.delivered",
    created_at: now.toISOString(),
    data: { email_id: "provider-message-id" },
  });
  const request = await signedRequest(original);
  const response = await handleResendWebhook(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: `${original} `,
    }),
    { gateway: gateway([]), now: () => now, webhookSecret: secret },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: "invalid_webhook", message: "Invalid webhook." },
  });
});

Deno.test("signed event outside the allowlist is acknowledged without a write", async () => {
  const recorded: unknown[] = [];
  const response = await handleResendWebhook(
    await signedRequest(JSON.stringify({ type: "email.opened", data: {} })),
    { gateway: gateway(recorded), now: () => now, webhookSecret: secret },
  );
  assert.equal(response.status, 200);
  assert.equal(recorded.length, 0);
});
