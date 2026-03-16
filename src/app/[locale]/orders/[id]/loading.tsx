import { Skeleton } from '@/components/ui/skeleton';

export default function OrderDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-24 rounded-2xl" />
      </div>
      <div className="space-y-6">
        {/* Status message */}
        <Skeleton className="h-5 w-72" />
        {/* Timeline card */}
        <div className="rounded-lg border border-semantic-border-subtle p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
        </div>
        {/* Details card */}
        <div className="rounded-lg border border-semantic-border-subtle p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
