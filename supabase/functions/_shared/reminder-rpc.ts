import { isValidUuid, isValidYearMonth } from "./reminder-email.ts";
import type { FinalizeOutcome } from "./resend.ts";

export interface RpcResult {
  data: unknown;
  error: unknown;
}

export interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
}

export interface ClaimedReminder {
  attemptCount: number;
  claimToken: string;
  deliveryId: string;
  firstAttemptAt: string;
  reviewYearMonth: string;
  scheduledFor: string;
}

export interface AuthorizedReminder {
  authorized: true;
  claimToken: string;
  deliveryId: string;
  recipientEmail: string;
  reviewYearMonth: string;
  unsubscribeToken: string;
}

export interface FinalizeReminderInput {
  claimToken: string;
  deliveryId: string;
  errorCode: string | null;
  nextAttemptAt: string | null;
  outcome: FinalizeOutcome;
  providerMessageId: string | null;
}

export interface ProviderEventInput {
  eventId: string;
  eventType: string;
  occurredAt: string;
  providerMessageId: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  maximumLength = 512,
): string {
  const candidate = value[key];
  if (
    typeof candidate !== "string" || candidate.length === 0 ||
    candidate.length > maximumLength
  ) {
    throw new Error("rpc_contract_invalid");
  }
  return candidate;
}

async function callRpc(
  client: RpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`rpc_failed:${name}`);
  return data;
}

export function createReminderRpcGateway(clientValue: unknown) {
  if (
    !clientValue || typeof clientValue !== "object" ||
    typeof Reflect.get(clientValue, "rpc") !== "function"
  ) {
    throw new Error("rpc_client_invalid");
  }
  const rpc = Reflect.get(clientValue, "rpc") as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const client: RpcClient = {
    rpc: (name, args) => rpc.call(clientValue, name, args),
  };
  return {
    async claim(limit: number): Promise<ClaimedReminder[]> {
      const data = await callRpc(client, "claim_review_email_reminders", {
        p_limit: limit,
      });
      if (!Array.isArray(data)) throw new Error("rpc_contract_invalid");
      return data.map((item) => {
        const value = record(item);
        if (!value) throw new Error("rpc_contract_invalid");
        const deliveryId = requiredString(value, "delivery_id");
        const claimToken = requiredString(value, "claim_token");
        const reviewYearMonth = requiredString(value, "review_year_month");
        const firstAttemptAt = requiredString(value, "first_attempt_at");
        const scheduledFor = requiredString(value, "scheduled_for");
        const attemptCount = value.attempt_count;
        if (
          !isValidUuid(deliveryId) || !isValidUuid(claimToken) ||
          !isValidYearMonth(reviewYearMonth) ||
          typeof attemptCount !== "number" || !Number.isInteger(attemptCount) ||
          !Number.isFinite(Date.parse(firstAttemptAt)) ||
          !Number.isFinite(Date.parse(scheduledFor))
        ) {
          throw new Error("rpc_contract_invalid");
        }
        return {
          deliveryId,
          claimToken,
          reviewYearMonth,
          firstAttemptAt,
          attemptCount,
          scheduledFor,
        };
      });
    },

    async authorize(
      deliveryId: string,
      claimToken: string,
    ): Promise<AuthorizedReminder | null> {
      const data = await callRpc(
        client,
        "authorize_review_email_reminder_send",
        { p_delivery_id: deliveryId, p_claim_token: claimToken },
      );
      const value = record(data);
      if (!value || typeof value.authorized !== "boolean") {
        throw new Error("rpc_contract_invalid");
      }
      if (!value.authorized) return null;
      const authorizedDeliveryId = requiredString(value, "delivery_id");
      const authorizedClaimToken = requiredString(value, "claim_token");
      const recipientEmail = requiredString(value, "recipient_email");
      const reviewYearMonth = requiredString(value, "review_year_month");
      const unsubscribeToken = requiredString(value, "unsubscribe_token");
      if (
        authorizedDeliveryId !== deliveryId ||
        authorizedClaimToken !== claimToken ||
        !isValidYearMonth(reviewYearMonth) || !isValidUuid(unsubscribeToken)
      ) {
        throw new Error("rpc_contract_invalid");
      }
      return {
        authorized: true,
        deliveryId: authorizedDeliveryId,
        claimToken: authorizedClaimToken,
        recipientEmail,
        reviewYearMonth,
        unsubscribeToken,
      };
    },

    async finalize(input: FinalizeReminderInput): Promise<void> {
      await callRpc(client, "finalize_review_email_reminder", {
        p_delivery_id: input.deliveryId,
        p_claim_token: input.claimToken,
        p_outcome: input.outcome,
        p_provider_message_id: input.providerMessageId,
        p_error_code: input.errorCode,
        p_next_attempt_at: input.nextAttemptAt,
      });
    },

    async recordProviderEvent(input: ProviderEventInput): Promise<boolean> {
      const data = await callRpc(client, "record_review_email_provider_event", {
        p_provider_message_id: input.providerMessageId,
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_occurred_at: input.occurredAt,
      });
      const value = record(data);
      if (!value || typeof value.matched !== "boolean") {
        throw new Error("rpc_contract_invalid");
      }
      return value.matched;
    },

    async unsubscribe(token: string): Promise<void> {
      await callRpc(client, "unsubscribe_review_email_reminder", {
        p_unsubscribe_token: token,
      });
    },
  };
}

export type ReminderRpcGateway = ReturnType<typeof createReminderRpcGateway>;
