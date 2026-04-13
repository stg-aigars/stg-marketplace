import { Skeleton } from '@/components/ui/skeleton';

export default function WantedDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-40 mb-4" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: image */}
        <div>
          <div className="rounded-lg border border-semantic-border-subtle overflow-hidden">
            <Skeleton className="aspect-square rounded-none" />
          </div>
        </div>

        {/* Right column: details */}
        <div className="space-y-6">
          {/* Title + badge */}
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          {/* Edition info */}
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Buyer card */}
          <div className="rounded-lg border border-semantic-border-subtle p-4">
            <Skeleton className="h-5 w-16 mb-3" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
          {/* Notes card */}
          <div className="rounded-lg border border-semantic-border-subtle p-4">
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
