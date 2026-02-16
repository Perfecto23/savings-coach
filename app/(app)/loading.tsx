export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-orange-100" />
      <div className="h-4 w-64 rounded bg-orange-50" />

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="h-6 w-32 rounded bg-gray-100" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full rounded bg-gray-50" />
          <div className="h-4 w-3/4 rounded bg-gray-50" />
          <div className="h-4 w-1/2 rounded bg-gray-50" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`skeleton-card-${i}`}
            className="rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="h-5 w-24 rounded bg-gray-100" />
            <div className="mt-3 h-8 w-20 rounded bg-gray-50" />
          </div>
        ))}
      </div>
    </div>
  );
}
