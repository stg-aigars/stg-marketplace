import Link from 'next/link';
import { ChatCircle } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { canMessageSeller } from '@/lib/messaging/cta-loader';
import type { MessagingEntryPoint } from '@/lib/messaging/types';

interface MessageSellerCTAProps {
  viewerId: string | null;
  targetId: string;
  /** When present, the chip is auto-seeded into the new-thread composer. */
  seedListingId?: string;
  entryPoint: MessagingEntryPoint;
  /** Layout hint — defaults to a full-width Card-friendly block. */
  variant?: 'block' | 'inline';
  targetRole?: 'buyer' | 'seller';
}

export async function MessageSellerCTA({
  viewerId,
  targetId,
  seedListingId,
  entryPoint,
  variant = 'block',
  targetRole = 'seller',
}: MessageSellerCTAProps) {
  const result = await canMessageSeller(viewerId, targetId);

  // 'self' is intentionally fully hidden — owner sees no chrome at all.
  if (!result.visible && result.reason === 'self') return null;

  if (!result.visible && result.reason === 'unauthenticated') {
    return (
      <p className={variant === 'inline' ? 'text-xs text-semantic-text-muted' : 'text-sm text-semantic-text-muted'}>
        <Link href="/auth/signin" className="link-brand">
          Sign in
        </Link>
        {' to send a message.'}
      </p>
    );
  }

  if (!result.visible) {
    return (
      <p className={variant === 'inline' ? 'text-xs text-semantic-text-muted' : 'text-sm text-semantic-text-muted'}>
        {targetRole === 'buyer'
          ? 'This buyer isn’t accepting new messages right now.'
          : 'This seller isn’t accepting new messages right now.'}
      </p>
    );
  }

  const params = new URLSearchParams({ to: targetId, from: entryPoint });
  if (seedListingId) params.set('seedListingId', seedListingId);
  const href = `/account/messages/new?${params.toString()}`;

  return (
    <Button variant="secondary" asChild>
      <Link href={href}>
        <ChatCircle size={18} className="mr-1.5" />
        {targetRole === 'buyer' ? 'Message buyer' : 'Message seller'}
      </Link>
    </Button>
  );
}
