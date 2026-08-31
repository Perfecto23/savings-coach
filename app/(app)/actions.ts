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
    | "ACTION_UPDATE_FAILED"
): HomeActionState {
  return { status: "error", error: { code } };
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
    return errorState("UNAUTHENTICATED");
  }

  const actionId = readString(formData, "action_id");
  if (!UUID_PATTERN.test(actionId)) {
    return errorState("INVALID_ACTION");
  }

  const operation = readString(formData, "operation");
  if (operation !== "complete" && operation !== "undo") {
    return errorState("INVALID_ACTION");
  }

  const { data, error } = await supabase.rpc("update_monthly_action", {
    p_action_id: actionId,
    p_patch: { completed: operation === "complete" },
  });
  if (error?.code === "P0001" && error.message === "monthly_action_not_found") {
    return errorState("ACTION_NOT_FOUND");
  }
  if (error?.code === "P0001" && error.message === "month_review_closed") {
    return errorState("MONTH_CLOSED");
  }
  if (error) {
    return errorState("ACTION_UPDATE_FAILED");
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
