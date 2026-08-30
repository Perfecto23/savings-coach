import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ImpulseLog } from "@/lib/types/database";
import { ImpulsePageClient } from "./impulse-client";

export default async function ImpulsePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [logsRes, totalRes, setupRes] = await Promise.all([
    supabase
      .from("impulse_logs")
      .select("id, item_name, estimated_price, reason, resisted, logged_at, created_at")
      .eq("owner_id", user.id)
      .eq("resisted", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("impulse_logs")
      .select("estimated_price")
      .eq("owner_id", user.id)
      .eq("resisted", true),
    supabase
      .from("owner_setup")
      .select("locale, base_currency")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const logs = (logsRes.data || []) as ImpulseLog[];
  const total = (totalRes.data || []).reduce(
    (sum: number, row: { estimated_price: number }) => sum + row.estimated_price,
    0
  );

  return (
    <ImpulsePageClient
      initialLogs={logs}
      initialTotal={total}
      locale={setupRes.data?.locale ?? "en-US"}
      baseCurrency={setupRes.data?.base_currency ?? "USD"}
    />
  );
}
