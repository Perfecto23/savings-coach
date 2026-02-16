"use client";

import { useState, useRef, useEffect } from "react";
import type { AiMessage } from "@/lib/types/database";
import { MessageBubble } from "./message-bubble";

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages: AiMessage[];
}

export function ChatInterface({
  conversationId,
  initialMessages,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    setInput("");
    setError(null);
    setStreaming(true);

    // 添加用户消息
    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 占位 AI 回复
    const aiMsgId = crypto.randomUUID();
    const aiMsg: AiMessage = {
      id: aiMsgId,
      conversation_id: conversationId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: fullText } : m
          )
        );
      }
      setLastFailedMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请重试");
      setLastFailedMessage(trimmed);
      // Remove both orphaned messages
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId && m.id !== userMsg.id));
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col md:h-[calc(100vh-8rem)]">
      {/* 消息区域 */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-1 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">开始和 AI 教练对话吧！</p>
          </div>
        )}

        {messages
          .filter((m) => m.role !== "system")
          .map((msg) => (
            <MessageBubble key={msg.id} role={msg.role as "user" | "assistant"} content={msg.content} />
          ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-1 mb-2 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          <span className="flex-1">{error}</span>
          {lastFailedMessage && (
            <button
              type="button"
              onClick={() => {
                setInput(lastFailedMessage);
                setError(null);
                setLastFailedMessage(null);
              }}
              className="cursor-pointer rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
            >
              重试
            </button>
          )}
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t border-gray-200 bg-white/80 p-3 backdrop-blur-sm">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息… (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="cursor-pointer rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
