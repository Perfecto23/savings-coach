import { createClient } from "@/lib/supabase/server";
import type { AiConfig } from "@/lib/types/database";

export async function getActiveAiConfig(): Promise<AiConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_configs")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return data as AiConfig | null;
}
