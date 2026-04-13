import { Skeleton } from '@/components/ui/skeleton';

export default function OffersLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-9 w-32 mb-4" />
      {/* Nav tabs */}
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-10 w-28" />
      </div>
      {/* Tabs (sent/received) */}
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Offer cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle p-4 flex gap-4">
            <Skeleton className="h-14 w-14 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-md self-start" />
          </div>
        ))}
      </div>
    </div>
  );
}
