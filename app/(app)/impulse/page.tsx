import { createClient } from "@/lib/supabase/server";
import type { ImpulseLog } from "@/lib/types/database";
import { ImpulsePageClient } from "./impulse-client";

export default async function ImpulsePage() {
  const supabase = await createClient();

  const [logsRes, totalRes] = await Promise.all([
    supabase
      .from("impulse_logs")
      .select("*")
      .eq("resisted", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("impulse_logs")
      .select("estimated_price")
      .eq("resisted", true),
  ]);

  const logs = (logsRes.data || []) as ImpulseLog[];
  const total = (totalRes.data || []).reduce(
    (sum: number, row: { estimated_price: number }) => sum + row.estimated_price,
    0
  );

  return <ImpulsePageClient initialLogs={logs} initialTotal={total} />;
}
