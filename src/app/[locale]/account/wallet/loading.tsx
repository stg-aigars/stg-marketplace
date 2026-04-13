import { Skeleton } from '@/components/ui/skeleton';

export default function WalletLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Skeleton className="h-9 w-28 mb-6" />
      {/* Balance card */}
      <div className="rounded-lg border border-semantic-border-subtle p-4 text-center py-8">
        <Skeleton className="h-4 w-28 mx-auto mb-2" />
        <Skeleton className="h-10 w-32 mx-auto" />
      </div>
      {/* Transaction history */}
      <div className="mt-6">
        <Skeleton className="h-7 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-semantic-border-subtle p-4 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
