import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { getSetupState } from "@/lib/setup/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setupState = await getSetupState();
  if (!setupState.isComplete) redirect("/setup");

  return (
    <div className="flex h-dvh overflow-hidden bg-linear-to-br from-amber-50 to-orange-50">
      <Suspense>
        <Sidebar className="hidden md:flex" />
      </Suspense>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-20 md:px-8 md:pb-6">
        {children}
      </main>

      <Suspense>
        <MobileNav className="md:hidden" />
      </Suspense>
    </div>
  );
}
