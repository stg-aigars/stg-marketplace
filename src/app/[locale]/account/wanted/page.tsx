import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Cube } from '@phosphor-icons/react/ssr';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getMyWantedListings } from '@/lib/wanted/actions';
import { Button, EmptyState } from '@/components/ui';
import { WantedListingsManager } from './WantedListingsManager';

export const metadata: Metadata = {
  title: 'My wanted games',
};

export default async function MyWantedPage() {
  await requireServerAuth();
  const listings = await getMyWantedListings();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          My wanted games
        </h1>
        <Button size="sm" asChild>
          <Link href="/wanted/new">
            <Plus size={16} weight="bold" className="mr-1.5" />
            Post a want
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon={Cube}
          title="No wanted games on your list"
          description="Post the games you're after — we'll email you when a matching one gets listed."
          action={{ label: 'Post a want', href: '/wanted/new', variant: 'primary' }}
        />
      ) : (
        <WantedListingsManager listings={listings} />
      )}
    </div>
  );
}
