"use server";

import type { ActionResult, AiConversation } from "@/lib/types/database";

export async function createConversation(
  _type: AiConversation["conversation_type"]
): Promise<ActionResult<AiConversation>> {
  void _type;
  return { success: false, error: "当前版本未开放 AI Coach" };
}
