export default function MainLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      {/* Header skeleton */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-gray-100" />
          <div className="h-5 w-16 rounded bg-gray-100" />
          <div className="h-10 w-10 rounded-full bg-gray-100" />
        </div>
        {/* Search bar skeleton */}
        <div className="px-4 pb-2">
          <div className="h-10 w-full rounded-full bg-[#F0F0F0]" />
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-2 px-4 pb-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-16 shrink-0 rounded-full bg-gray-100" />
          ))}
        </div>
      </header>

      {/* Card skeletons */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.08)]"
            style={{ borderLeft: "4px solid #E5E7EB" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="h-5 w-16 rounded-full bg-gray-100" />
              <div className="h-7 w-7 rounded-full bg-gray-100" />
            </div>
            <div className="mb-3 h-4 w-3/4 rounded bg-gray-100" />
            <div className="space-y-2">
              <div className="h-3 w-1/2 rounded bg-gray-50" />
              <div className="h-3 w-2/3 rounded bg-gray-50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
