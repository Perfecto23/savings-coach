export default function SetupLoading() {
  return (
    <main
      lang="en"
      aria-busy="true"
      className="grid min-h-dvh bg-[#f6f1e8] lg:grid-cols-[minmax(320px,0.8fr)_minmax(560px,1.2fr)]"
    >
      <span className="sr-only" role="status">
        Loading your Setup…
      </span>
      <div className="min-h-72 animate-pulse bg-stone-950 px-8 py-8 lg:min-h-dvh">
        <div className="h-10 w-40 rounded-full bg-stone-800" />
        <div className="mt-20 h-14 max-w-sm rounded-xl bg-stone-800" />
        <div className="mt-5 h-5 max-w-xs rounded-full bg-stone-800" />
        <div className="mt-16 grid gap-4">
          <div className="h-8 max-w-xs rounded-full bg-stone-800" />
          <div className="h-8 max-w-xs rounded-full bg-stone-800" />
          <div className="h-8 max-w-xs rounded-full bg-stone-800" />
        </div>
      </div>
      <div className="px-5 py-10 sm:px-10 lg:flex lg:items-center lg:px-16">
        <div className="mx-auto w-full max-w-xl animate-pulse">
          <div className="h-5 w-28 rounded-full bg-stone-200" />
          <div className="mt-5 h-10 w-72 max-w-full rounded-xl bg-stone-200" />
          <div className="mt-8 h-12 w-full rounded-xl bg-stone-200" />
          <div className="mt-5 h-12 w-full rounded-xl bg-stone-200" />
        </div>
      </div>
    </main>
  );
}
