'use client';

import { useTransition, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
        <svg
          className="w-5 h-5 text-aurora-red"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-semantic-text-muted hover:text-aurora-red transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      )}
    </button>
  );
}

export { FavoriteButton };
