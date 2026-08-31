export default function SavingsPlanLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse pb-10" aria-busy="true">
      <div className="border-b border-stone-200 pb-10 pt-4">
        <div className="h-12 w-full max-w-2xl rounded-xl bg-stone-200" />
        <div className="mt-5 h-6 w-full max-w-xl rounded-lg bg-stone-100" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="h-96 rounded-xl border border-stone-200 bg-white" />
        <div className="h-72 rounded-xl bg-stone-900" />
      </div>
    </div>
  );
}
