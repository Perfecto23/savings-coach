"use server";

import { revalidatePath } from "next/cache";
import type { PaidIntentActionState } from "@/lib/paid-intent/contracts";
import { createClient } from "@/lib/supabase/server";

interface PaidIntentReceipt {
  offer_code?: string;
  recorded_at?: string;
  recorded_now?: boolean;
}

const OFFER_CODE = "pro_beta_usd_499_monthly_v1";

export async function recordPaidIntent(
  _previousState: PaidIntentActionState
): Promise<PaidIntentActionState> {
  void _previousState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      error: { code: "UNAUTHENTICATED" },
    };
  }

  const { data, error } = await supabase.rpc("record_paid_intent");
  if (error?.code === "P0001" && error.message === "paid_intent_not_eligible") {
    return {
      status: "error",
      error: {
        code: "NOT_ELIGIBLE",
      },
    };
  }
  if (error) {
    return {
      status: "error",
      error: {
        code: "RECORD_FAILED",
      },
    };
  }

  const receipt = data as PaidIntentReceipt | null;
  if (
    receipt?.offer_code !== OFFER_CODE ||
    !receipt.recorded_at ||
    typeof receipt.recorded_now !== "boolean"
  ) {
    return {
      status: "error",
      error: {
        code: "RECORD_FAILED",
      },
    };
  }

  revalidatePath("/milestones");
  return { status: "success", error: null };
}
