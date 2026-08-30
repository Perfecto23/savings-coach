import {
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  readRequestBody,
} from "../_shared/http.ts";
import type { ReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import { verifySvixSignature } from "../_shared/svix.ts";

const ALLOWED_EVENTS = new Set([
  "email.bounced",
  "email.complained",
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.sent",
  "email.suppressed",
]);
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

interface ResendWebhookEvent {
  createdAt: string;
  emailId: string;
  type: string;
}

function parseAllowedEvent(
  payload: string,
): ResendWebhookEvent | null | "ignored" {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const type = Reflect.get(value, "type");
  if (typeof type !== "string") return null;
  if (!ALLOWED_EVENTS.has(type)) return "ignored";
  const createdAt = Reflect.get(value, "created_at");
  const data = Reflect.get(value, "data");
  const emailId = data && typeof data === "object"
    ? Reflect.get(data, "email_id")
    : null;
  if (
    typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)) ||
    typeof emailId !== "string" || emailId.length === 0 ||
    emailId.length > 128 ||
    !PROVIDER_ID_PATTERN.test(emailId)
  ) {
    return null;
  }
  return { type, createdAt, emailId };
}

export interface WebhookDependencies {
  gateway: ReminderRpcGateway;
  now: () => Date;
  webhookSecret: string | undefined;
}

export async function handleResendWebhook(
  request: Request,
  dependencies: WebhookDependencies,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!dependencies.webhookSecret) {
    return errorResponse(
      "webhook_not_configured",
      "Webhook processing is not configured.",
      503,
    );
  }

  const payload = await readRequestBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (payload === null) {
    return errorResponse(
      "request_body_too_large",
      "Request body is too large.",
      413,
    );
  }
  const svixId = request.headers.get("svix-id");
  const verified = await verifySvixSignature({
    payload,
    secret: dependencies.webhookSecret,
    now: dependencies.now(),
    headers: {
      id: svixId,
      signature: request.headers.get("svix-signature"),
      timestamp: request.headers.get("svix-timestamp"),
    },
  });
  if (
    !verified || !svixId || svixId.length > 256 ||
    !PROVIDER_ID_PATTERN.test(svixId)
  ) {
    return errorResponse("invalid_webhook", "Invalid webhook.", 400);
  }

  const event = parseAllowedEvent(payload);
  if (event === "ignored") {
    return jsonResponse({ received: true, ignored: true });
  }
  if (!event) {
    return errorResponse("invalid_webhook", "Invalid webhook.", 400);
  }

  try {
    const matched = await dependencies.gateway.recordProviderEvent({
      eventId: svixId,
      eventType: event.type,
      occurredAt: new Date(event.createdAt).toISOString(),
      providerMessageId: event.emailId,
    });
    if (!matched) {
      console.error(
        JSON.stringify({
          event: "review_reminder_webhook_provider_event_not_ready",
        }),
      );
      return errorResponse(
        "provider_event_not_ready",
        "Provider event is not ready.",
        503,
      );
    }
    console.log(JSON.stringify({ event: "review_reminder_webhook_processed" }));
    return jsonResponse({ received: true });
  } catch {
    console.error(JSON.stringify({ event: "review_reminder_webhook_failed" }));
    return errorResponse(
      "processing_failed",
      "Webhook processing failed.",
      500,
    );
  }
}
