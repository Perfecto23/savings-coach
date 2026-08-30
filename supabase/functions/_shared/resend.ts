export type FinalizeOutcome =
  | "accepted"
  | "ambiguous_retry"
  | "failed"
  | "retry_wait"
  | "unknown";

export interface ProviderClassification {
  errorCode: string | null;
  outcome: FinalizeOutcome;
  providerMessageId: string | null;
  retryAfterSeconds: number | null;
}

const UNKNOWN_AFTER_MS = 23 * 60 * 60 * 1000;

function elapsedBeyondRetryWindow(firstAttemptAt: string, now: Date): boolean {
  const startedAt = Date.parse(firstAttemptAt);
  return Number.isFinite(startedAt) &&
    now.getTime() - startedAt >= UNKNOWN_AFTER_MS;
}

function parseErrorType(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const type = Reflect.get(body, "name") ?? Reflect.get(body, "type");
  return typeof type === "string" && /^[a-z0-9_]{1,48}$/.test(type)
    ? type
    : null;
}

function parseProviderMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const id = Reflect.get(body, "id");
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id)
    ? id
    : null;
}

function boundedRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(Math.ceil(seconds), 3600);
}

export function classifyResendResponse(input: {
  body: unknown;
  firstAttemptAt: string;
  now: Date;
  retryAfter: string | null;
  status: number;
}): ProviderClassification {
  const providerMessageId = parseProviderMessageId(input.body);
  if (input.status >= 200 && input.status < 300 && providerMessageId) {
    return {
      outcome: "accepted",
      providerMessageId,
      errorCode: null,
      retryAfterSeconds: null,
    };
  }

  const errorType = parseErrorType(input.body);
  if (input.status === 409 && errorType === "invalid_idempotent_request") {
    return {
      outcome: "failed",
      providerMessageId: null,
      errorCode: "resend_invalid_idempotent_request",
      retryAfterSeconds: null,
    };
  }

  const ambiguous = input.status === 409 || input.status >= 500 ||
    (input.status >= 200 && input.status < 300) ||
    errorType === "concurrent_idempotent_requests";
  if (ambiguous && elapsedBeyondRetryWindow(input.firstAttemptAt, input.now)) {
    return {
      outcome: "unknown",
      providerMessageId: null,
      errorCode: "resend_result_unknown",
      retryAfterSeconds: null,
    };
  }

  if (input.status === 429) {
    return {
      outcome: "retry_wait",
      providerMessageId: null,
      errorCode: `resend_${errorType ?? "rate_limited"}`,
      retryAfterSeconds: boundedRetryAfter(input.retryAfter) ?? 60,
    };
  }
  if (ambiguous) {
    return {
      outcome: "ambiguous_retry",
      providerMessageId: null,
      errorCode: input.status === 409
        ? "resend_concurrent_idempotent_request"
        : "resend_result_ambiguous",
      retryAfterSeconds: 300,
    };
  }

  return {
    outcome: "failed",
    providerMessageId: null,
    errorCode: `resend_${errorType ?? `http_${input.status}`}`,
    retryAfterSeconds: null,
  };
}

export function classifyResendNetworkError(
  firstAttemptAt: string,
  now: Date,
): ProviderClassification {
  if (elapsedBeyondRetryWindow(firstAttemptAt, now)) {
    return {
      outcome: "unknown",
      providerMessageId: null,
      errorCode: "resend_network_result_unknown",
      retryAfterSeconds: null,
    };
  }
  return {
    outcome: "ambiguous_retry",
    providerMessageId: null,
    errorCode: "resend_network_error",
    retryAfterSeconds: 300,
  };
}

export async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
