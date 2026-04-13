import { Skeleton } from '@/components/ui/skeleton';

export default function CartLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      {/* Seller group cards */}
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle p-4">
            {/* Seller header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-semantic-border">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Items */}
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-md flex-shrink-0" />
                  <Skeleton className="h-4 w-40 flex-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-semantic-border flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
