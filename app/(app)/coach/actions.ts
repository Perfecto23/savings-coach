"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, AiConversation } from "@/lib/types/database";

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const TYPE_TITLES: Record<string, string> = {
  review: "月度复盘",
  advice: "请求建议",
  plan: "调整计划",
  general: "随便聊聊",
};

const CONVERSATION_TYPES = ["review", "advice", "plan", "general"] as const;

export async function createConversation(
  type: AiConversation["conversation_type"]
): Promise<ActionResult<AiConversation>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };
  if (!CONVERSATION_TYPES.includes(type as (typeof CONVERSATION_TYPES)[number])) return { success: false, error: "对话类型无效" };
  const yearMonth = getCurrentYearMonth();

  const title = `${TYPE_TITLES[type] || type} - ${yearMonth}`;

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      year_month: yearMonth,
      title,
      conversation_type: type,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as AiConversation };
}
