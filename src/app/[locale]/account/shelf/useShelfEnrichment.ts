'use client';

import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import type { ShelfItemWithGame } from '@/lib/shelves/types';

const MAX_BATCH_SIZE = 20;

/**
 * Progressively enriches shelf items that are missing thumbnails.
 * Calls POST /api/games/enrich-batch in batches of 20.
 * Only runs once per mount.
 */
export function useShelfEnrichment(
  items: ShelfItemWithGame[],
  setItems: React.Dispatch<React.SetStateAction<ShelfItemWithGame[]>>
): void {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;

    const missingItems = items.filter((item) => !item.thumbnail);
    if (missingItems.length === 0) return;

    hasRunRef.current = true;

    async function enrichBatch(ids: number[]) {
      try {
        const res = await apiFetch('/api/games/enrich-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok) return;

        const data = await res.json();
        const games: Record<number, { thumbnail: string | null; image: string | null }> =
          data.games ?? {};

        setItems((prev) =>
          prev.map((item) => {
            const enriched = games[item.bgg_game_id];
            if (enriched && !item.thumbnail) {
              return {
                ...item,
                thumbnail: enriched.thumbnail,
                image: enriched.image,
              };
            }
            return item;
          })
        );
      } catch {
        // Non-fatal — items just won't have thumbnails
      }
    }

    // Batch into groups of MAX_BATCH_SIZE
    const allIds = missingItems.map((item) => item.bgg_game_id);
    const batches: number[][] = [];
    for (let i = 0; i < allIds.length; i += MAX_BATCH_SIZE) {
      batches.push(allIds.slice(i, i + MAX_BATCH_SIZE));
    }

    // Process batches sequentially to avoid overwhelming the API
    async function processBatches() {
      for (const batch of batches) {
        await enrichBatch(batch);
      }
    }

    processBatches();
  }, [items, setItems]);
}
