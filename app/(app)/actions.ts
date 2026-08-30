"use server";

import { revalidatePath } from "next/cache";
import type { HomeActionState } from "@/lib/home/contracts";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MonthlyActionRpcResult {
  behavior_activated_now?: boolean;
}

function errorState(
  code:
    | "UNAUTHENTICATED"
    | "ACTION_NOT_FOUND"
    | "INVALID_ACTION"
    | "MONTH_CLOSED"
    | "ACTION_UPDATE_FAILED",
  message: string
): HomeActionState {
  return { status: "error", error: { code, message } };
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateHomePaths() {
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/sop");
  revalidatePath("/milestones");
}

export async function updateHomeAction(
  _previousState: HomeActionState,
  formData: FormData
): Promise<HomeActionState> {
  void _previousState;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorState("UNAUTHENTICATED", "Please sign in again.");
  }

  const actionId = readString(formData, "action_id");
  if (!UUID_PATTERN.test(actionId)) {
    return errorState("INVALID_ACTION", "Reload Home and try again.");
  }

  const operation = readString(formData, "operation");
  if (operation !== "complete" && operation !== "undo") {
    return errorState("INVALID_ACTION", "Reload Home and try again.");
  }

  const { data, error } = await supabase.rpc("update_monthly_action", {
    p_action_id: actionId,
    p_patch: { completed: operation === "complete" },
  });
  if (error?.code === "P0001" && error.message === "monthly_action_not_found") {
    return errorState(
      "ACTION_NOT_FOUND",
      "This Monthly Action is no longer available. Reload Home."
    );
  }
  if (error?.code === "P0001" && error.message === "month_review_closed") {
    return errorState(
      "MONTH_CLOSED",
      "This month is closed. Its Monthly Actions cannot be changed."
    );
  }
  if (error) {
    return errorState(
      "ACTION_UPDATE_FAILED",
      "The Monthly Action could not be updated. Try again."
    );
  }

  revalidateHomePaths();
  return {
    status: "success",
    error: null,
    operation,
    behaviorActivatedNow: Boolean(
      (data as MonthlyActionRpcResult | null)?.behavior_activated_now
    ),
  };
}
