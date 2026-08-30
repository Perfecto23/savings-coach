import assert from "node:assert/strict";
import type { ReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import {
  createSenderEndpointHandler,
  handleAuthorizedSenderRequest,
} from "./handler.ts";

const deliveryId = "11111111-1111-4111-8111-111111111111";
const claimToken = "22222222-2222-4222-8222-222222222222";
const unsubscribeToken = "33333333-3333-4333-8333-333333333333";

function fakeGateway(
  overrides: Record<string, unknown> = {},
): ReminderRpcGateway {
  return {
    claim: async () => [],
    authorize: async () => null,
    finalize: async () => {},
    recordProviderEvent: async () => true,
    unsubscribe: async () => {},
    ...overrides,
  } as ReminderRpcGateway;
}

const environment = {
  appBaseUrl: "https://app.example.test",
  from: "Savings Coach <review@example.test>",
  resendApiKey: "test-provider-key",
  sendingEnabled: "true",
  supabaseUrl: "https://project.supabase.co",
};

Deno.test("sender is POST-only before auth", async () => {
  let authCalls = 0;
  const handler = createSenderEndpointHandler(
    () => async () => {
      authCalls += 1;
      return new Response(null, { status: 204 });
    },
    { environment, fetch, now: () => new Date(), sleep: async () => {} },
  );
  const response = await handler(
    new Request("https://example.test", { method: "GET" }),
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(authCalls, 0);
});

Deno.test("sender normalizes named-secret auth failure", async () => {
  const handler = createSenderEndpointHandler(
    () => async () => new Response("provider detail", { status: 401 }),
    { environment, fetch, now: () => new Date(), sleep: async () => {} },
  );
  const response = await handler(
    new Request("https://example.test", { method: "POST" }),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: "unauthorized", message: "Unauthorized." },
  });
});

Deno.test("kill switch stops claim and provider work", async () => {
  let claimCalls = 0;
  const response = await handleAuthorizedSenderRequest(
    new Request("https://example.test", { method: "POST" }),
    {
      environment: { ...environment, sendingEnabled: "false" },
      fetch: () => {
        throw new Error("provider must not run");
      },
      gateway: fakeGateway({
        claim: async () => {
          claimCalls += 1;
          return [];
        },
      }),
      now: () => new Date(),
      sleep: async () => {},
    },
  );
  assert.equal(response.status, 503);
  assert.equal(claimCalls, 0);
});

Deno.test("invalid URL or From configuration returns 503 before claim", async () => {
  let claimCalls = 0;
  const invalidEnvironments = [
    { ...environment, appBaseUrl: "http://app.example.test" },
    {
      ...environment,
      from: "Savings Coach <review@example.test>\r\nBcc: attacker@example.test",
    },
  ];
  for (const invalidEnvironment of invalidEnvironments) {
    const response = await handleAuthorizedSenderRequest(
      new Request("https://example.test", { method: "POST" }),
      {
        environment: invalidEnvironment,
        fetch,
        gateway: fakeGateway({
          claim: async () => {
            claimCalls += 1;
            return [];
          },
        }),
        now: () => new Date(),
        sleep: async () => {},
      },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "sending_not_configured",
        message: "Review reminder sending is not configured.",
      },
    });
  }
  assert.equal(claimCalls, 0);
});

Deno.test("invalid authorized recipient is finalized without a provider call", async () => {
  const finalized: unknown[] = [];
  let providerCalls = 0;
  const now = new Date("2026-08-31T12:00:00.000Z");
  const response = await handleAuthorizedSenderRequest(
    new Request("https://example.test", { method: "POST" }),
    {
      environment,
      gateway: fakeGateway({
        claim: async () => [{
          attemptCount: 1,
          claimToken,
          deliveryId,
          firstAttemptAt: now.toISOString(),
          reviewYearMonth: "2026-08",
          scheduledFor: now.toISOString(),
        }],
        authorize: async () => ({
          authorized: true,
          claimToken,
          deliveryId,
          recipientEmail: "person@example.test\r\nBcc: attacker@example.test",
          reviewYearMonth: "2026-08",
          unsubscribeToken,
        }),
        finalize: async (value: unknown) => finalized.push(value),
      }),
      fetch: async () => {
        providerCalls += 1;
        return Response.json({ id: "provider-message-id" });
      },
      now: () => now,
      sleep: async () => {},
    },
  );
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 0);
  assert.equal(finalized.length, 1);
  assert.deepEqual(finalized[0], {
    claimToken,
    deliveryId,
    errorCode: "invalid_recipient_email",
    nextAttemptAt: null,
    outcome: "failed",
    providerMessageId: null,
  });
});

Deno.test("sender ignores request owner and email and sends privacy-safe payload", async () => {
  const finalized: unknown[] = [];
  const providerRequests: Request[] = [];
  const now = new Date("2026-08-31T12:00:00.000Z");
  const response = await handleAuthorizedSenderRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        owner_id: "attacker-owner",
        email: "attacker@example.test",
        app_base_url: "https://attacker.example.test",
        from: "attacker@example.test",
      }),
    }),
    {
      environment,
      gateway: fakeGateway({
        claim: async () => [{
          attemptCount: 1,
          claimToken,
          deliveryId,
          firstAttemptAt: now.toISOString(),
          reviewYearMonth: "2026-08",
          scheduledFor: now.toISOString(),
        }],
        authorize: async () => ({
          authorized: true,
          claimToken,
          deliveryId,
          recipientEmail: "authorized@example.test",
          reviewYearMonth: "2026-08",
          unsubscribeToken,
        }),
        finalize: async (value: unknown) => finalized.push(value),
      }),
      fetch: async (input, init) => {
        providerRequests.push(new Request(input, init));
        return Response.json({ id: "provider-message-id" });
      },
      now: () => now,
      sleep: async () => {},
    },
  );
  assert.equal(response.status, 200);
  const providerRequest = providerRequests[0];
  assert.ok(providerRequest);
  assert.equal(providerRequest.headers.get("idempotency-key"), deliveryId);
  const payloadText = await providerRequest.text();
  assert.match(payloadText, /authorized@example\.test/);
  assert.match(payloadText, /https:\/\/app\.example\.test/);
  assert.match(payloadText, /Savings Coach <review@example\.test>/);
  assert.doesNotMatch(
    payloadText,
    /attacker-owner|attacker@example\.test|attacker\.example\.test/,
  );
  assert.doesNotMatch(
    payloadText,
    /\$|€|£|¥|\baccount\b|\bamount\b/i,
  );
  assert.match(payloadText, /List-Unsubscribe/);
  assert.equal(finalized.length, 1);
  assert.equal((finalized[0] as { outcome: string }).outcome, "accepted");
});

Deno.test("sender spaces sequential provider requests at four per second or less", async () => {
  const now = new Date("2026-08-31T12:00:00.000Z");
  const deliveryIds = [
    "11111111-1111-4111-8111-111111111111",
    "44444444-4444-4444-8444-444444444444",
  ];
  const sleepCalls: number[] = [];
  const response = await handleAuthorizedSenderRequest(
    new Request("https://example.test", { method: "POST" }),
    {
      environment,
      gateway: fakeGateway({
        claim: async () =>
          deliveryIds.map((id) => ({
            attemptCount: 1,
            claimToken,
            deliveryId: id,
            firstAttemptAt: now.toISOString(),
            reviewYearMonth: "2026-08",
            scheduledFor: now.toISOString(),
          })),
        authorize: async (id: string) => ({
          authorized: true,
          claimToken,
          deliveryId: id,
          recipientEmail: "authorized@example.test",
          reviewYearMonth: "2026-08",
          unsubscribeToken,
        }),
        finalize: async () => {},
      }),
      fetch: async () => Response.json({ id: "provider_message" }),
      now: () => now,
      sleep: async (milliseconds) => {
        sleepCalls.push(milliseconds);
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(sleepCalls, [250]);
});
