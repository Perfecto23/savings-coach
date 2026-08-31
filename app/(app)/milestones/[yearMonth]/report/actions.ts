"use server";

import { revalidatePath } from "next/cache";
import type {
  MonthlyReviewActionState,
  MonthlyReviewErrorCode,
} from "@/lib/monthly-review/contracts";
import { createClient } from "@/lib/supabase/server";

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

interface MonthlyReviewReceipt {
  reviewed_year_month?: string;
  review_completed_at?: string;
  next_year_month?: string;
}

function failure(
  code: MonthlyReviewErrorCode
): MonthlyReviewActionState {
  return { status: "error", error: { code } };
}

export async function closeMonthlyReview(
  _previousState: MonthlyReviewActionState,
  formData: FormData
): Promise<MonthlyReviewActionState> {
  void _previousState;
  const yearMonthValue = formData.get("year_month");
  const yearMonth =
    typeof yearMonthValue === "string" ? yearMonthValue.trim() : "";
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) {
    return failure("INVALID_MONTH");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return failure("UNAUTHENTICATED");
  }

  const { data, error } = await supabase.rpc("close_monthly_review", {
    p_year_month: yearMonth,
  });
  if (error?.code === "P0001") {
    if (error.message === "monthly_actions_incomplete") {
      return failure("ACTIONS_INCOMPLETE");
    }
    if (error.message === "no_active_plan_rules") {
      return failure("PLAN_NOT_READY");
    }
    if (
      error.message === "review_month_not_found" ||
      error.message === "monthly_actions_missing" ||
      error.message === "review_month_not_elapsed" ||
      error.message === "review_month_out_of_window"
    ) {
      return failure("MONTH_NOT_AVAILABLE");
    }
  }
  if (error) {
    return failure("REVIEW_FAILED");
  }

  const receipt = data as MonthlyReviewReceipt | null;
  if (
    !receipt?.reviewed_year_month ||
    !receipt.review_completed_at ||
    !receipt.next_year_month
  ) {
    return failure("REVIEW_FAILED");
  }

  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/sop");
  revalidatePath("/milestones");
  revalidatePath(`/milestones/${yearMonth}/report`);

  return {
    status: "success",
    error: null,
    reviewedYearMonth: receipt.reviewed_year_month,
    reviewCompletedAt: receipt.review_completed_at,
    nextYearMonth: receipt.next_year_month,
  };
}
