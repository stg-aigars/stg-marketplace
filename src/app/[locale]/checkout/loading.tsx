import { Skeleton } from '@/components/ui/skeleton';

export default function CheckoutLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-9 w-48 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-semantic-border-subtle p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="rounded-lg border border-semantic-border-subtle p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="rounded-lg border border-semantic-border-subtle p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-11 w-full mt-4" />
        </div>
      </div>
    </div>
  );
}
