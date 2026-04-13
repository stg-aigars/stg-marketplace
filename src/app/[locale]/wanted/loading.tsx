import { Skeleton } from '@/components/ui/skeleton';

export default function WantedLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      {/* Nav tabs */}
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      {/* Filter bar */}
      <Skeleton className="h-10 w-full mb-6 rounded-md" />
      {/* Card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle overflow-hidden">
            <Skeleton className="aspect-square rounded-none" />
            <div className="px-3 py-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
