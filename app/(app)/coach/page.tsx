import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "@/components/coach/conversation-list";
import type { AiConversation } from "@/lib/types/database";

export default async function CoachPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("ai_conversations")
    .select("*")
    .order("updated_at", { ascending: false });

  const conversations = (data || []) as AiConversation[];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 教练</h1>
        <p className="mt-1 text-sm text-gray-500">
          你的智能财务顾问，帮你复盘和制定计划
        </p>
      </div>

      <ConversationList conversations={conversations} />
    </div>
  );
}
