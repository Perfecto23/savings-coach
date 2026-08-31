"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, ImpulseLog } from "@/lib/types/database";

export async function addImpulseLog(
  formData: FormData
): Promise<ActionResult<ImpulseLog>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };

  const itemName = (formData.get("item_name") as string) || "";
  const estimatedPrice = Number(formData.get("estimated_price"));
  const category = formData.get("category") as string | null;

  if (!itemName.trim()) return { success: false, error: "INVALID_ITEM_NAME" };
  if (!Number.isFinite(estimatedPrice) || estimatedPrice <= 0) return { success: false, error: "INVALID_AMOUNT" };
  if (category != null && String(category).trim() === "") return { success: false, error: "INVALID_CATEGORY" };

  const { data, error } = await supabase
    .from("impulse_logs")
    .insert({
      owner_id: user.id,
      item_name: itemName.trim(),
      estimated_price: estimatedPrice,
      reason: (formData.get("reason") as string) || null,
      resisted: true,
    })
    .select("id, item_name, estimated_price, reason, resisted, logged_at, created_at")
    .single();

  if (error) return { success: false, error: "SAVE_FAILED" };
  revalidatePath("/impulse");
  return { success: true, data: data as ImpulseLog };
}

export async function deleteImpulseLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "UNAUTHENTICATED" };
  const { data, error } = await supabase
    .from("impulse_logs")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: "SAVE_FAILED" };
  if (!data) return { success: false, error: "NOT_FOUND" };
  revalidatePath("/impulse");
  return { success: true, data: undefined };
}
