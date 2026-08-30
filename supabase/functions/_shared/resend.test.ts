import assert from "node:assert/strict";
import {
  classifyResendNetworkError,
  classifyResendResponse,
} from "./resend.ts";

const now = new Date("2026-08-31T12:00:00.000Z");
const recent = "2026-08-31T11:00:00.000Z";
const expired = "2026-08-30T12:59:59.000Z";

Deno.test("Resend 2xx with id is Provider Acceptance", () => {
  assert.deepEqual(
    classifyResendResponse({
      body: { id: "provider-id" },
      firstAttemptAt: recent,
      now,
      retryAfter: null,
      status: 200,
    }),
    {
      errorCode: null,
      outcome: "accepted",
      providerMessageId: "provider-id",
      retryAfterSeconds: null,
    },
  );
});

Deno.test("Resend 409 distinguishes payload conflict and concurrency", () => {
  assert.equal(
    classifyResendResponse({
      body: { name: "invalid_idempotent_request" },
      firstAttemptAt: recent,
      now,
      retryAfter: null,
      status: 409,
    }).outcome,
    "failed",
  );
  assert.equal(
    classifyResendResponse({
      body: { name: "concurrent_idempotent_requests" },
      firstAttemptAt: recent,
      now,
      retryAfter: null,
      status: 409,
    }).outcome,
    "ambiguous_retry",
  );
  assert.equal(
    classifyResendResponse({
      body: null,
      firstAttemptAt: recent,
      now,
      retryAfter: null,
      status: 409,
    }).outcome,
    "ambiguous_retry",
  );
});

Deno.test("Resend 429 schedules a bounded retry", () => {
  const result = classifyResendResponse({
    body: { name: "rate_limit_exceeded" },
    firstAttemptAt: recent,
    now,
    retryAfter: "75",
    status: 429,
  });
  assert.equal(result.outcome, "retry_wait");
  assert.equal(result.retryAfterSeconds, 75);
});

Deno.test("ambiguous 5xx and network results become unknown after 23 hours", () => {
  assert.equal(
    classifyResendResponse({
      body: null,
      firstAttemptAt: recent,
      now,
      retryAfter: null,
      status: 503,
    }).outcome,
    "ambiguous_retry",
  );
  assert.equal(
    classifyResendResponse({
      body: null,
      firstAttemptAt: expired,
      now,
      retryAfter: null,
      status: 503,
    }).outcome,
    "unknown",
  );
  assert.equal(
    classifyResendNetworkError(recent, now).outcome,
    "ambiguous_retry",
  );
  assert.equal(classifyResendNetworkError(expired, now).outcome, "unknown");
});
