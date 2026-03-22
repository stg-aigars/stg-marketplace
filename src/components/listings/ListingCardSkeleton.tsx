import { Card, Skeleton } from '@/components/ui';

function ListingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Image placeholder */}
      <Skeleton className="h-40 sm:h-44 lg:h-48 rounded-none" />

      {/* Details */}
      <div className="px-3 py-3 space-y-2">
        <div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-12 mt-1" />
        </div>
        <Skeleton className="h-5 w-20 rounded-2xl" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

export { ListingCardSkeleton };
