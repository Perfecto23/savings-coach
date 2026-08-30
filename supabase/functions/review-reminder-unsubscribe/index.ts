import { withSupabase } from "npm:@supabase/server@1.4.1";
import { createReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import { handleReviewReminderUnsubscribe } from "./handler.ts";

const handler = withSupabase(
  { auth: "none", cors: "disabled" },
  async (request, context) =>
    handleReviewReminderUnsubscribe(
      request,
      createReminderRpcGateway(context.supabaseAdmin),
    ),
);

Deno.serve(handler);
