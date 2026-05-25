import Link from 'next/link';
import { ChatCircle } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { canMessageSeller } from '@/lib/messaging/cta-loader';

interface MessageSellerCTAProps {
  viewerId: string | null;
  sellerId: string;
  /** When present, the chip is auto-seeded into the new-thread composer. */
  seedListingId?: string;
  entryPoint: 'listing_detail' | 'seller_profile';
  /** Layout hint — defaults to a full-width Card-friendly block. */
  variant?: 'block' | 'inline';
}

export async function MessageSellerCTA({
  viewerId,
  sellerId,
  seedListingId,
  entryPoint,
  variant = 'block',
}: MessageSellerCTAProps) {
  const result = await canMessageSeller(viewerId, sellerId);

  // 'self' is intentionally fully hidden — owner sees no chrome at all.
  if (!result.visible && result.reason === 'self') return null;

  if (!result.visible && result.reason === 'unauthenticated') {
    return (
      <p className={variant === 'inline' ? 'text-xs text-semantic-text-muted' : 'text-sm text-semantic-text-muted'}>
        <Link href="/auth/signin" className="link-brand">
          Sign in
        </Link>
        {' to message the seller.'}
      </p>
    );
  }

  if (!result.visible) {
    return (
      <p className={variant === 'inline' ? 'text-xs text-semantic-text-muted' : 'text-sm text-semantic-text-muted'}>
        This seller isn&rsquo;t accepting new messages right now.
      </p>
    );
  }

  const params = new URLSearchParams({ to: sellerId, from: entryPoint });
  if (seedListingId) params.set('seedListingId', seedListingId);
  const href = `/account/messages/new?${params.toString()}`;

  return (
    <Button variant="secondary" asChild>
      <Link href={href}>
        <ChatCircle size={18} className="mr-1.5" />
        Message seller
      </Link>
    </Button>
  );
}
