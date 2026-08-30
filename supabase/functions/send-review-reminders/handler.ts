import {
  errorResponse,
  jsonResponse,
  methodNotAllowed,
} from "../_shared/http.ts";
import {
  buildReviewReminderEmail,
  isValidEmailAddress,
  validateReviewReminderConfiguration,
} from "../_shared/reminder-email.ts";
import type { ReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import {
  classifyResendNetworkError,
  classifyResendResponse,
  parseJsonResponse,
  type ProviderClassification,
} from "../_shared/resend.ts";

const CLAIM_LIMIT = 20;
const MINIMUM_SEND_INTERVAL_MS = 250;

export interface SenderEnvironment {
  appBaseUrl: string | undefined;
  from: string | undefined;
  resendApiKey: string | undefined;
  sendingEnabled: string | undefined;
  supabaseUrl: string | undefined;
}

export interface SenderCoreDependencies {
  environment: SenderEnvironment;
  fetch: typeof fetch;
  gateway: ReminderRpcGateway;
  now: () => Date;
  sleep: (milliseconds: number) => Promise<void>;
}

export type SenderProtectedHandler = (
  request: Request,
) => Promise<Response>;

export type SenderProtection = (
  core: (
    request: Request,
    gateway: ReminderRpcGateway,
  ) => Promise<Response>,
) => SenderProtectedHandler;

function configuredEnvironment(environment: SenderEnvironment):
  | {
    appBaseUrl: string;
    from: string;
    resendApiKey: string;
    supabaseUrl: string;
  }
  | null {
  if (
    !environment.appBaseUrl || !environment.from ||
    !environment.resendApiKey || !environment.supabaseUrl ||
    !validateReviewReminderConfiguration({
      appBaseUrl: environment.appBaseUrl,
      from: environment.from,
      supabaseUrl: environment.supabaseUrl,
    })
  ) {
    return null;
  }
  return {
    appBaseUrl: environment.appBaseUrl,
    from: environment.from,
    resendApiKey: environment.resendApiKey,
    supabaseUrl: environment.supabaseUrl,
  };
}

async function finalizeClassification(
  gateway: ReminderRpcGateway,
  claim: { claimToken: string; deliveryId: string },
  classification: ProviderClassification,
  now: Date,
): Promise<void> {
  const nextAttemptAt = classification.outcome === "retry_wait" ||
      classification.outcome === "ambiguous_retry"
    ? new Date(
      now.getTime() + (classification.retryAfterSeconds ?? 300) * 1000,
    ).toISOString()
    : null;
  await gateway.finalize({
    claimToken: claim.claimToken,
    deliveryId: claim.deliveryId,
    errorCode: classification.errorCode,
    nextAttemptAt,
    outcome: classification.outcome,
    providerMessageId: classification.providerMessageId,
  });
}

export async function handleAuthorizedSenderRequest(
  request: Request,
  dependencies: SenderCoreDependencies,
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (dependencies.environment.sendingEnabled !== "true") {
    return errorResponse(
      "sending_disabled",
      "Review reminder sending is disabled.",
      503,
    );
  }
  const environment = configuredEnvironment(dependencies.environment);
  if (!environment) {
    return errorResponse(
      "sending_not_configured",
      "Review reminder sending is not configured.",
      503,
    );
  }

  try {
    const claims = await dependencies.gateway.claim(CLAIM_LIMIT);
    const counts = {
      accepted: 0,
      claimed: claims.length,
      failed: 0,
      retryScheduled: 0,
      skipped: 0,
      unknown: 0,
    };
    let sentCount = 0;

    for (const claim of claims) {
      const authorized = await dependencies.gateway.authorize(
        claim.deliveryId,
        claim.claimToken,
      );
      if (!authorized) {
        counts.skipped += 1;
        continue;
      }
      if (authorized.reviewYearMonth !== claim.reviewYearMonth) {
        throw new Error("rpc_contract_invalid");
      }
      if (!isValidEmailAddress(authorized.recipientEmail)) {
        await dependencies.gateway.finalize({
          claimToken: claim.claimToken,
          deliveryId: claim.deliveryId,
          errorCode: "invalid_recipient_email",
          nextAttemptAt: null,
          outcome: "failed",
          providerMessageId: null,
        });
        counts.failed += 1;
        continue;
      }
      if (sentCount > 0) {
        await dependencies.sleep(MINIMUM_SEND_INTERVAL_MS);
      }
      sentCount += 1;

      const email = buildReviewReminderEmail({
        appBaseUrl: environment.appBaseUrl,
        deliveryId: claim.deliveryId,
        from: environment.from,
        recipientEmail: authorized.recipientEmail,
        reviewYearMonth: authorized.reviewYearMonth,
        supabaseUrl: environment.supabaseUrl,
        unsubscribeToken: authorized.unsubscribeToken,
      });
      const attemptedAt = dependencies.now();
      let classification: ProviderClassification;
      try {
        const providerResponse = await dependencies.fetch(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${environment.resendApiKey}`,
              "content-type": "application/json",
              "idempotency-key": email.idempotencyKey,
            },
            body: JSON.stringify(email.payload),
            signal: AbortSignal.timeout(10_000),
          },
        );
        classification = classifyResendResponse({
          body: await parseJsonResponse(providerResponse),
          firstAttemptAt: claim.firstAttemptAt,
          now: attemptedAt,
          retryAfter: providerResponse.headers.get("retry-after"),
          status: providerResponse.status,
        });
      } catch {
        classification = classifyResendNetworkError(
          claim.firstAttemptAt,
          attemptedAt,
        );
      }

      await finalizeClassification(
        dependencies.gateway,
        claim,
        classification,
        dependencies.now(),
      );
      if (classification.outcome === "accepted") counts.accepted += 1;
      else if (
        classification.outcome === "retry_wait" ||
        classification.outcome === "ambiguous_retry"
      ) {
        counts.retryScheduled += 1;
      } else if (classification.outcome === "unknown") counts.unknown += 1;
      else counts.failed += 1;
    }

    console.log(JSON.stringify({ event: "review_reminder_sender", ...counts }));
    return jsonResponse(counts);
  } catch {
    console.error(JSON.stringify({ event: "review_reminder_sender_failed" }));
    return errorResponse(
      "processing_failed",
      "Review reminder processing failed.",
      500,
    );
  }
}

export function createSenderEndpointHandler(
  protect: SenderProtection,
  dependencies: Omit<SenderCoreDependencies, "gateway">,
): SenderProtectedHandler {
  const protectedHandler = protect((request, gateway) =>
    handleAuthorizedSenderRequest(request, { ...dependencies, gateway })
  );
  return async (request) => {
    if (request.method !== "POST") return methodNotAllowed("POST");
    const response = await protectedHandler(request);
    if (response.status === 401 || response.status === 403) {
      return errorResponse("unauthorized", "Unauthorized.", 401);
    }
    return response;
  };
}
