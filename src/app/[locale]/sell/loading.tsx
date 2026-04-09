import { Skeleton } from '@/components/ui/skeleton';

export default function SellLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-9 w-48 mb-6" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
