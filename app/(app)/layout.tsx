import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-linear-to-br from-amber-50 to-orange-50">
      <Sidebar className="hidden md:flex" />

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-20 md:px-8 md:pb-6">
        {children}
      </main>

      <MobileNav className="md:hidden" />
    </div>
  );
}
