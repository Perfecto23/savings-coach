import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/coach/chat-interface";
import type { AiConversation, AiMessage } from "@/lib/types/database";

interface CoachChatPageProps {
  params: Promise<{ id: string }>;
}

export default async function CoachChatPage({ params }: CoachChatPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [convRes, messagesRes] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at"),
  ]);

  if (convRes.error || !convRes.data) {
    notFound();
  }

  const conversation = convRes.data as AiConversation;
  const messages = (messagesRes.data || []) as AiMessage[];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/coach"
          className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="返回对话列表"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" aria-hidden="true">
            <title>返回</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-900">{conversation.title}</h1>
      </div>

      <ChatInterface
        conversationId={id}
        initialMessages={messages}
      />
    </div>
  );
}
