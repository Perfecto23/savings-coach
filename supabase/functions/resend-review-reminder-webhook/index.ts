import { withSupabase } from "npm:@supabase/server@1.4.1";
import { createReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import { handleResendWebhook } from "./handler.ts";

const handler = withSupabase(
  { auth: "none", cors: "disabled" },
  async (request, context) =>
    handleResendWebhook(request, {
      gateway: createReminderRpcGateway(context.supabaseAdmin),
      now: () => new Date(),
      webhookSecret: Deno.env.get("RESEND_WEBHOOK_SECRET"),
    }),
);

const app = { fetch: handler };

export default app;
