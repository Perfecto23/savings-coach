import assert from "node:assert/strict";
import type { ReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import { handleReviewReminderUnsubscribe } from "./handler.ts";

function gateway(tokens: string[]): ReminderRpcGateway {
  return {
    claim: async () => [],
    authorize: async () => null,
    finalize: async () => {},
    recordProviderEvent: async () => true,
    unsubscribe: async (token: string) => {
      tokens.push(token);
    },
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

Deno.test("unsubscribe GET only renders confirmation and performs no write", async () => {
  const tokens: string[] = [];
  const response = await handleReviewReminderUnsubscribe(
    new Request(
      "https://example.test/functions/v1/review-reminder-unsubscribe?token=11111111-1111-4111-8111-111111111111",
    ),
    gateway(tokens),
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>退订月度复盘邮件提醒</);
  assert.match(html, /确定退订月度复盘邮件提醒？/);
  assert.match(html, /不会再发送未来的月度复盘邮件提醒/);
  assert.match(html, />确认退订</);
  assert.deepEqual(tokens, []);
});

Deno.test("unsubscribe POST response is blank and constant for known-shaped and malformed tokens", async () => {
  const tokens: string[] = [];
  const responses = [];
  for (
    const token of [
      "11111111-1111-4111-8111-111111111111",
      "not-a-token",
    ]
  ) {
    responses.push(
      await handleReviewReminderUnsubscribe(
        new Request(
          `https://example.test/functions/v1/review-reminder-unsubscribe?token=${token}`,
          {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "List-Unsubscribe=One-Click",
          },
        ),
        gateway(tokens),
      ),
    );
  }
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
  }
  assert.equal(tokens.length, 2);
  assert.notEqual(tokens[0], tokens[1]);
});

Deno.test("unsubscribe processing failure returns a Chinese public error", async () => {
  const failingGateway = {
    ...gateway([]),
    unsubscribe: async () => {
      throw new Error("synthetic failure");
    },
  } as ReminderRpcGateway;
  const response = await handleReviewReminderUnsubscribe(
    new Request(
      "https://example.test/functions/v1/review-reminder-unsubscribe?token=11111111-1111-4111-8111-111111111111",
      { method: "POST" },
    ),
    failingGateway,
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: "processing_failed", message: "退订处理失败。" },
  });
});

Deno.test("unsubscribe rejects a body over 8 KiB from Content-Length before reading it", async () => {
  const tokens: string[] = [];
  const response = await handleReviewReminderUnsubscribe(
    new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": String(8 * 1024 + 1) },
      body: "token=11111111-1111-4111-8111-111111111111",
    }),
    gateway(tokens),
  );
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: {
      code: "request_body_too_large",
      message: "请求内容过大。",
    },
  });
  assert.deepEqual(tokens, []);
});

Deno.test("unsubscribe stops a chunked body over 8 KiB without Content-Length", async () => {
  const tokens: string[] = [];
  const { request, wasCancelled } = streamingRequest([
    new Uint8Array(8 * 1024),
    new Uint8Array([0]),
  ]);
  const response = await handleReviewReminderUnsubscribe(
    request,
    gateway(tokens),
  );
  assert.equal(response.status, 413);
  assert.equal(wasCancelled(), true);
  assert.deepEqual(tokens, []);
});
