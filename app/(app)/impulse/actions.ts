"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, ImpulseLog } from "@/lib/types/database";

export async function addImpulseLog(
  formData: FormData
): Promise<ActionResult<ImpulseLog>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const itemName = (formData.get("item_name") as string) || "";
  const estimatedPrice = Number(formData.get("estimated_price"));
  const category = formData.get("category") as string | null;

  if (!itemName.trim()) return { success: false, error: "物品名称不能为空" };
  if (!Number.isFinite(estimatedPrice) || estimatedPrice <= 0) return { success: false, error: "预估价格无效" };
  if (category != null && String(category).trim() === "") return { success: false, error: "分类不能为空" };

  const { data, error } = await supabase
    .from("impulse_logs")
    .insert({
      item_name: itemName.trim(),
      estimated_price: estimatedPrice,
      reason: (formData.get("reason") as string) || null,
      resisted: true,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/impulse");
  return { success: true, data: data as ImpulseLog };
}

export async function deleteImpulseLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  const { error } = await supabase.from("impulse_logs").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/impulse");
  return { success: true, data: undefined };
}
