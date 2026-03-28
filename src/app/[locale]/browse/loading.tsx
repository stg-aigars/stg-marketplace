import { Skeleton } from '@/components/ui/skeleton';

export default function BrowseLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-9 w-64 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-semantic-border-subtle overflow-hidden">
            <Skeleton className="aspect-square rounded-none" />
            <div className="px-3 py-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
