'use client';

import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import type { ShelfItemWithGame } from '@/lib/shelves/types';

const MAX_BATCH_SIZE = 20;

/**
 * Progressively enriches shelf items that are missing thumbnails.
 * Tracks enriched IDs so newly added items get enriched too.
 */
export function useShelfEnrichment(
  items: ShelfItemWithGame[],
  setItems: React.Dispatch<React.SetStateAction<ShelfItemWithGame[]>>
): void {
  const enrichedIdsRef = useRef<Set<number>>(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    const missingItems = items.filter(
      (item) => !item.thumbnail && !enrichedIdsRef.current.has(item.bgg_game_id)
    );
    if (missingItems.length === 0 || runningRef.current) return;

    runningRef.current = true;
    let cancelled = false;

    async function enrichBatch(ids: number[]) {
      try {
        const res = await apiFetch('/api/games/enrich-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();
        const games: Record<number, { thumbnail: string | null; image: string | null }> =
          data.games ?? {};

        // Mark all requested IDs as enriched (even if BGG had no data)
        for (const id of ids) {
          enrichedIdsRef.current.add(id);
        }

        if (cancelled) return;

        setItems((prev) =>
          prev.map((item) => {
            const enriched = games[item.bgg_game_id];
            if (enriched && !item.thumbnail) {
              return { ...item, thumbnail: enriched.thumbnail, image: enriched.image };
            }
            return item;
          })
        );
      } catch {
        // Non-fatal
      }
    }

    async function processBatches() {
      const allIds = missingItems.map((item) => item.bgg_game_id);
      for (let i = 0; i < allIds.length; i += MAX_BATCH_SIZE) {
        if (cancelled) break;
        await enrichBatch(allIds.slice(i, i + MAX_BATCH_SIZE));
      }
      runningRef.current = false;
    }

    processBatches();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [items, setItems]);
}
