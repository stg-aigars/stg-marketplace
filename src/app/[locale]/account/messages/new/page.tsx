import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { findExistingThread } from '@/lib/messaging/actions';
import { BackLink, Card, CardBody, CardHeader, UserIdentity } from '@/components/ui';
import { ListingChipInline } from '../[threadId]/ListingChipInline';
import { NewMessageForm } from './NewMessageForm';

export const metadata: Metadata = {
  title: 'New message',
};

interface PageProps {
  searchParams: Promise<{
    to?: string;
    seedListingId?: string;
    from?: string;
  }>;
}

const ALLOWED_ENTRY_POINTS = new Set(['listing_detail', 'seller_profile']);

export default async function NewMessagePage({ searchParams }: PageProps) {
  const { to, seedListingId, from } = await searchParams;
  if (!to) notFound();

  const { user } = await requireServerAuth();
  if (to === user.id) notFound();

  // If a thread already exists, route to it directly (preserving the seed listing chip on the URL).
  const { threadId } = await findExistingThread(to);
  if (threadId) {
    const qs = seedListingId ? `?seedListingId=${seedListingId}` : '';
    redirect(`/account/messages/${threadId}${qs}`);
  }

  const supabase = await createClient();

  const { data: counterparty } = await supabase
    .from('public_profiles')
    .select('id, full_name, avatar_url, country')
    .eq('id', to)
    .maybeSingle();

  if (!counterparty) notFound();

  let seedListing: {
    id: string;
    game_name: string;
    price_cents: number;
    primary_photo_url: string | null;
  } | null = null;
  if (seedListingId) {
    const { data } = await supabase
      .from('listings')
      .select('id, game_name, price_cents, primary_photo_url, seller_id')
      .eq('id', seedListingId)
      .maybeSingle();
    if (data && data.seller_id === to) {
      seedListing = {
        id: data.id,
        game_name: data.game_name,
        price_cents: data.price_cents,
        primary_photo_url: data.primary_photo_url,
      };
    }
  }

  const entryPoint = from && ALLOWED_ENTRY_POINTS.has(from)
    ? (from as 'listing_detail' | 'seller_profile')
    : 'seller_profile';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <BackLink href="/account/messages" label="All messages" />
      </div>

      <Card>
        <CardHeader>
          <UserIdentity
            name={counterparty.full_name ?? 'Unknown'}
            avatarUrl={counterparty.avatar_url}
            country={counterparty.country}
            size="md"
          />
        </CardHeader>

        <CardBody className="space-y-4">
          {seedListing && (
            <div>
              <p className="text-xs text-semantic-text-muted mb-1.5">About:</p>
              <ListingChipInline listing={seedListing} />
            </div>
          )}

          <NewMessageForm
            otherUserId={to}
            seedListingId={seedListing?.id}
            entryPoint={entryPoint}
          />
        </CardBody>
      </Card>
    </div>
  );
}
