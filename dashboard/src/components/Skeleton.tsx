export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="h-4 w-3/4" />
          <SkeletonLine className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-5/6" />
      <div className="flex gap-2 pt-1">
        <SkeletonLine className="h-5 w-16 rounded-full" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-gray-100">
      <div className="p-4">
        <SkeletonLine className="h-5 w-32" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between px-6 py-4">
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-4 w-48" />
            <SkeletonLine className="h-3 w-32" />
          </div>
          <div className="flex items-center gap-4">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card p-6">
      <SkeletonLine className="h-5 w-32 mb-4" />
      <div className="h-[250px] flex items-end gap-3 px-4">
        {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
          <div key={i} className="flex-1">
            <div
              className="bg-gray-200 animate-pulse rounded-t"
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <SkeletonLine className="h-4 w-24" />
            <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse" />
          </div>
          <SkeletonLine className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
