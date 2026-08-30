import assert from "node:assert/strict";
import {
  createReminderRpcGateway,
  type ProviderEventInput,
} from "./reminder-rpc.ts";

const providerEvent: ProviderEventInput = {
  eventId: "event_123",
  eventType: "email.delivered",
  occurredAt: "2026-08-31T12:00:00.000Z",
  providerMessageId: "provider-message-id",
};

function rpcClient(data: unknown) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data, error: null };
      },
    },
  };
}

Deno.test("RPC gateway returns false when provider event is not matched", async () => {
  const { client, calls } = rpcClient({ matched: false });
  const gateway = createReminderRpcGateway(client);

  assert.equal(await gateway.recordProviderEvent(providerEvent), false);
  assert.deepEqual(calls, [{
    name: "record_review_email_provider_event",
    args: {
      p_provider_message_id: "provider-message-id",
      p_event_id: "event_123",
      p_event_type: "email.delivered",
      p_occurred_at: "2026-08-31T12:00:00.000Z",
    },
  }]);
});

Deno.test("RPC gateway returns true for a matched or duplicate provider event", async () => {
  const { client } = rpcClient({ matched: true, status: "delivered" });
  const gateway = createReminderRpcGateway(client);

  assert.equal(await gateway.recordProviderEvent(providerEvent), true);
  assert.equal(await gateway.recordProviderEvent(providerEvent), true);
});

Deno.test("RPC gateway rejects a provider event response without matched boolean", async () => {
  const { client } = rpcClient({ status: "delivered" });
  const gateway = createReminderRpcGateway(client);

  await assert.rejects(
    gateway.recordProviderEvent(providerEvent),
    /rpc_contract_invalid/,
  );
});
