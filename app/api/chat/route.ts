import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAiConfig } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import type {
  Account,
  BalanceSnapshot,
  MonthlyMilestone,
  SopRecord,
  BonusEvent,
  AiMessage,
} from "@/lib/types/database";

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 验证登录
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId, message } = await request.json();

  if (!conversationId || !message) {
    return new Response("Missing conversationId or message", { status: 400 });
  }

  // Verify conversation exists and belongs to user
  const { data: conversation, error: convError } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return new Response("对话不存在", { status: 404 });
  }

  // 获取 AI 配置
  const aiConfig = await getActiveAiConfig();
  if (!aiConfig) {
    return new Response("No active AI configuration found", { status: 400 });
  }

  const yearMonth = getCurrentYearMonth();

  // 并行获取上下文数据
  const [accountsRes, snapshotsRes, milestoneRes, sopRes, bonusRes, historyRes] =
    await Promise.all([
      supabase.from("accounts").select("*").order("sort_order"),
      supabase
        .from("balance_snapshots")
        .select("*")
        .order("recorded_at", { ascending: false }),
      supabase
        .from("monthly_milestones")
        .select("*")
        .eq("year_month", yearMonth)
        .maybeSingle(),
      supabase
        .from("sop_records")
        .select("*")
        .eq("year_month", yearMonth)
        .order("sort_order"),
      supabase.from("bonus_events").select("*").order("expected_date"),
      supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at"),
    ]);

  const accounts = (accountsRes.data || []) as Account[];
  const snapshots = (snapshotsRes.data || []) as BalanceSnapshot[];
  const milestone = milestoneRes.data as MonthlyMilestone | null;
  const sopRecords = (sopRes.data || []) as SopRecord[];
  const bonusEvents = (bonusRes.data || []) as BonusEvent[];
  const history = (historyRes.data || []) as AiMessage[];

  // 每个账户最新余额
  const latestByAccount = new Map<string, number>();
  for (const snap of snapshots) {
    if (!latestByAccount.has(snap.account_id)) {
      latestByAccount.set(snap.account_id, snap.balance);
    }
  }

  // 构建 system prompt
  const systemPrompt = buildSystemPrompt({
    accounts: accounts.map((a) => ({
      name: a.name,
      latest_balance: latestByAccount.get(a.id) ?? 0,
    })),
    currentMilestone: milestone
      ? {
          planned: milestone.planned_savings,
          actual: milestone.actual_savings,
        }
      : null,
    sopStatus: sopRecords.map((s) => ({
      label: s.step_label,
      completed: s.completed,
    })),
    incomePlan: bonusEvents.map((b) => ({
      label: b.label,
      amount: b.amount,
      date: b.expected_date,
      received: b.is_received,
    })),
  });

  // 构建消息列表
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // 保存用户消息
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // 调用 AI API（OpenAI 兼容协议）
  try {
    const apiUrl = aiConfig.api_url.endsWith("/")
      ? aiConfig.api_url
      : aiConfig.api_url + "/";

    const response = await fetch(`${apiUrl}chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.api_key}`,
      },
      body: JSON.stringify({
        model: aiConfig.model_name,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(`AI API Error: ${errorText}`, {
        status: response.status,
      });
    }

    // 流式转发
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

            for (const line of lines) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip invalid JSON
              }
            }
          }
        } finally {
          reader.releaseLock();

          // 保存 AI 回复
          if (fullResponse) {
            await supabase.from("ai_messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: fullResponse,
            });

            // 更新对话时间
            await supabase
              .from("ai_conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(`AI request failed: ${errMsg}`, { status: 500 });
  }
}
