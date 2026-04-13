import { Skeleton } from '@/components/ui/skeleton';

export default function ShelfLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      {/* Shelf item grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
