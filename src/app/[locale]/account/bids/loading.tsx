import { Skeleton } from '@/components/ui/skeleton';

export default function BidsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-9 w-32 mb-6" />
      {/* Bid section */}
      <Skeleton className="h-6 w-36 mb-3" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle p-4 flex gap-3">
            <Skeleton className="h-14 w-14 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-md self-start" />
          </div>
        ))}
      </div>
    </div>
  );
}
