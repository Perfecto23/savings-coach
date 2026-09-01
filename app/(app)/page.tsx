import { Suspense } from "react";
import { MonthlyExecutionHome } from "@/components/home/monthly-execution-home";
import { getHomeCopy } from "@/lib/home/presentation";
import { getMonthlyExecutionHome } from "@/lib/home/server";

async function HomeContent() {
  const home = await getMonthlyExecutionHome();
  return <MonthlyExecutionHome home={home} copy={getHomeCopy()} />;
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse pb-10" aria-busy="true">
      <div className="border-b border-stone-200 pb-10 pt-4">
        <div className="h-12 w-64 rounded-xl bg-stone-200" />
        <div className="mt-4 h-6 w-80 max-w-full rounded-lg bg-stone-100" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="h-96 rounded-xl bg-stone-900" />
        <div className="h-64 border-y border-stone-200" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
