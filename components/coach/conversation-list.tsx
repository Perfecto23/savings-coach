"use client";

import { createConversation } from "@/app/(app)/coach/actions";
import type { AiConversation } from "@/lib/types/database";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  review: "月度复盘",
  advice: "请求建议",
  plan: "调整计划",
  general: "随便聊聊",
};

const TYPE_COLORS: Record<string, string> = {
  review: "bg-blue-50 text-blue-700",
  advice: "bg-green-50 text-green-700",
  plan: "bg-purple-50 text-purple-700",
  general: "bg-gray-100 text-gray-600",
};

interface ConversationListProps {
  conversations: AiConversation[];
}

export function ConversationList({ conversations }: ConversationListProps) {
  const router = useRouter();
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate(type: string) {
    setLoading(true);
    const result = await createConversation(type as AiConversation["conversation_type"]);
    if (result.success) {
      router.push(`/coach/${result.data.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* 新建对话 */}
      {showNewForm ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">选择对话类型</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => handleCreate(type)}
                disabled={loading}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowNewForm(false)}
            className="mt-2 cursor-pointer text-xs text-gray-400 hover:text-gray-600"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          + 新建对话
        </button>
      )}

      {/* 对话列表 */}
      {conversations.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          还没有对话记录
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/coach/${conv.id}`}
              className="block cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-orange-200 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate font-medium text-gray-900">{conv.title}</h4>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    TYPE_COLORS[conv.conversation_type] || TYPE_COLORS.general
                  }`}
                >
                  {TYPE_LABELS[conv.conversation_type] || conv.conversation_type}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(conv.updated_at).toLocaleString("zh-CN")}
                {conv.year_month && ` · ${conv.year_month}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
