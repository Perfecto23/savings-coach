import { withSupabase } from "npm:@supabase/server@1.4.1";
import { createReminderRpcGateway } from "../_shared/reminder-rpc.ts";
import { createSenderEndpointHandler } from "./handler.ts";

let handler: ReturnType<typeof createSenderEndpointHandler> | undefined;

function getHandler() {
  handler ??= createSenderEndpointHandler(
    (core) =>
      withSupabase(
        { auth: "secret:reminder-cron", cors: "disabled" },
        async (request, context) =>
          core(
            request,
            createReminderRpcGateway(context.supabaseAdmin),
          ),
      ),
    {
      environment: {
        appBaseUrl: Deno.env.get("APP_BASE_URL"),
        from: Deno.env.get("REVIEW_EMAIL_FROM"),
        resendApiKey: Deno.env.get("RESEND_API_KEY"),
        sendingEnabled: Deno.env.get("REVIEW_EMAIL_SENDING_ENABLED"),
        supabaseUrl: Deno.env.get("SUPABASE_URL"),
      },
      fetch,
      now: () => new Date(),
      sleep: (milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)),
    },
  );
  return handler;
}

const app = {
  fetch: (request: Request) => getHandler()(request),
};

export default app;
