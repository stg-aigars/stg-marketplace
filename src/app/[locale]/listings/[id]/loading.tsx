import { Skeleton } from '@/components/ui/skeleton';

export default function ListingDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-4 w-48 mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Photo area */}
        <Skeleton className="aspect-square rounded-lg" />
        {/* Details */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-10 w-32" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-12 w-full mt-6" />
        </div>
      </div>
    </div>
  );
}
