'use client';

import { useTransition, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from '@phosphor-icons/react';
import { toggleFavorite } from '@/lib/favorites/actions';

interface FavoriteButtonProps {
  listingId: string;
  initialFavorited: boolean;
  /** Whether the user is authenticated. If false, clicking redirects to sign-in. */
  isAuthenticated: boolean;
  /** Overlay mode: absolute-positioned for ListingCard image overlay */
  overlay?: boolean;
}

function FavoriteButton({
  listingId,
  initialFavorited,
  isAuthenticated,
  overlay = false,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent navigating to listing when clicking on card overlay
      e.stopPropagation();

      if (!isAuthenticated) {
        router.push('/auth/signin');
        return;
      }

      // Optimistic update
      const previousState = favorited;
      setFavorited(!favorited);

      startTransition(async () => {
        const result = await toggleFavorite(listingId);
        if ('error' in result) {
          // Rollback on error
          setFavorited(previousState);
        } else {
          setFavorited(result.favorited);
        }
      });
    },
    [favorited, isAuthenticated, listingId, router]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      className={`${
        overlay
          ? 'absolute top-2 right-2 z-10 rounded-full bg-white/80 backdrop-blur-sm shadow-sm'
          : ''
      } min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
        isPending ? 'opacity-50' : ''
      }`}
    >
      {favorited ? (
        <Heart size={20} weight="fill" className="text-aurora-red" />
      ) : (
        <Heart size={20} className="text-semantic-text-muted hover:text-aurora-red transition-colors" />
      )}
    </button>
  );
}

export { FavoriteButton };
