import {
  emptyResponse,
  errorResponse,
  methodNotAllowed,
  readRequestBody,
} from "../_shared/http.ts";
import { isValidUuid } from "../_shared/reminder-email.ts";
import type { ReminderRpcGateway } from "../_shared/reminder-rpc.ts";

const INVALID_TOKEN_SENTINEL = "00000000-0000-4000-8000-000000000000";
const MAX_UNSUBSCRIBE_BODY_BYTES = 8 * 1024;

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function confirmationPage(token: string): Response {
  const action = token ? `?token=${encodeURIComponent(token)}` : "";
  const html = [
    "<!doctype html>",
    '<html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>退订月度复盘邮件提醒</title></head>",
    "<body><main>",
    "<h1>确定退订月度复盘邮件提醒？</h1>",
    "<p>退订后，系统不会再发送未来的月度复盘邮件提醒。</p>",
    `<form method="post" action="${escapeHtmlAttribute(action)}">`,
    '<input type="hidden" name="List-Unsubscribe" value="One-Click">',
    '<button type="submit">确认退订</button>',
    "</form></main></body></html>",
  ].join("");
  return new Response(html, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

async function requestToken(request: Request): Promise<string | null> {
  const urlToken = new URL(request.url).searchParams.get("token");
  const body = await readRequestBody(request, MAX_UNSUBSCRIBE_BODY_BYTES);
  if (body === null) return null;
  return urlToken || new URLSearchParams(body).get("token") || "";
}

export async function handleReviewReminderUnsubscribe(
  request: Request,
  gateway: ReminderRpcGateway,
): Promise<Response> {
  if (request.method === "GET") {
    return confirmationPage(
      new URL(request.url).searchParams.get("token") ?? "",
    );
  }
  if (request.method !== "POST") return methodNotAllowed("GET, POST");

  const token = await requestToken(request);
  if (token === null) {
    return errorResponse(
      "request_body_too_large",
      "请求内容过大。",
      413,
    );
  }
  try {
    await gateway.unsubscribe(
      isValidUuid(token) ? token : INVALID_TOKEN_SENTINEL,
    );
    console.log(JSON.stringify({ event: "review_reminder_unsubscribed" }));
    return emptyResponse();
  } catch {
    console.error(
      JSON.stringify({ event: "review_reminder_unsubscribe_failed" }),
    );
    return errorResponse(
      "processing_failed",
      "退订处理失败。",
      500,
    );
  }
}
