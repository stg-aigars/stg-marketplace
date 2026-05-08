'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowSquareOut, Check } from '@phosphor-icons/react/ssr';
import { Button, Skeleton } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { apiFetch } from '@/lib/api-fetch';
import { getConditionLabel } from '@/lib/condition-config';
import {
  calculateSuggestedPrice,
  CONDITION_MULTIPLIERS,
  MIN_SALES_FOR_MEDIAN,
  type PriceSuggestionResponse,
} from '@/lib/pricing/suggestions';
import type { ListingCondition } from '@/lib/listings/types';

interface PricingAssistantProps {
  bggGameId: number | null;
  gameName?: string;
  condition: ListingCondition | null;
  isAuction: boolean;
  onFillPrice: (cents: number) => void;
  expansionIds?: number[];
  expansionNames?: Record<number, string>;
}

export function PricingAssistant({
  bggGameId,
  gameName,
  condition,
  isAuction,
  onFillPrice,
  expansionIds = [],
  expansionNames = {},
}: PricingAssistantProps) {
  const [data, setData] = useState<PriceSuggestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filledButton, setFilledButton] = useState<string | null>(null);
  const fillTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clear fill feedback timer on unmount
  useEffect(() => () => clearTimeout(fillTimerRef.current), []);

  useEffect(() => {
    if (!bggGameId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const pricingUrl = expansionIds.length > 0
      ? `/api/games/${bggGameId}/pricing?expansionIds=${expansionIds.join(',')}`
      : `/api/games/${bggGameId}/pricing`;
    apiFetch(pricingUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result: PriceSuggestionResponse) => {
        if (controller.signal.aborted) return;
        setData(result);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('[PricingAssistant] Fetch error:', err);
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bggGameId, expansionIds.join(',')]);

  // Use bundle retail price if available, otherwise base game only
  const effectiveRetailCents = data?.bundleRetailPriceCents ?? data?.retailPriceCents;
  const hasBundle = data?.totalGames != null && data.totalGames > 1;

  const suggestedPriceCents = useMemo(
    () =>
      effectiveRetailCents && condition
        ? calculateSuggestedPrice(effectiveRetailCents, condition, isAuction)
        : null,
    [effectiveRetailCents, condition, isAuction],
  );

  const handleFill = (cents: number, buttonId: string) => {
    onFillPrice(cents);
    setFilledButton(buttonId);
    clearTimeout(fillTimerRef.current);
    fillTimerRef.current = setTimeout(() => setFilledButton(null), 1500);
  };

  if (!bggGameId || !condition) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    );
  }

  if (error || !data) return null;

  const { retailPriceCents, marketplace, attributionUrl } = data;
  const hasRetail = retailPriceCents != null && retailPriceCents > 0;
  const hasMedian =
    marketplace.medianSoldCents != null &&
    marketplace.completedSaleCount >= MIN_SALES_FOR_MEDIAN;
  const hasLowest = marketplace.lowestActiveCents != null;

  if (!hasRetail && !hasMedian && !hasLowest) return null;

  const conditionLabel = getConditionLabel(condition);
  const multiplierPct = Math.round(CONDITION_MULTIPLIERS[condition] * 100);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
        Price guide
      </p>

      {/* Market context (retail + STG marketplace data) — shown first so the
          suggested price below has visible inputs. */}
      {(hasRetail || hasLowest || hasMedian) && (
        <div className="space-y-2 rounded-lg bg-semantic-bg-surface px-3 py-2.5">
          <p className="text-xs font-medium text-semantic-text-muted uppercase tracking-wide">
            Market context
          </p>

          {hasRetail && (
            <>
              {hasBundle && data?.breakdown ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-semantic-text-muted">New retail (per game)</p>
                  {data.breakdown.map((item) => {
                    const name = item.bggGameId === bggGameId
                      ? (gameName ?? 'Base game')
                      : (expansionNames[item.bggGameId] ?? `Game ${item.bggGameId}`);
                    return (
                      <div key={item.bggGameId} className="flex items-center justify-between text-sm">
                        <span className="text-semantic-text-secondary truncate mr-3">{name}</span>
                        <span className="tabular-nums text-semantic-text-primary shrink-0">
                          {item.retailPriceCents != null
                            ? formatCentsToCurrency(item.retailPriceCents)
                            : '—'}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between text-sm pt-1.5 border-t border-semantic-border-subtle">
                    <span className="text-semantic-text-secondary font-medium">Bundle total</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-semantic-text-primary">
                        {formatCentsToCurrency(data.bundleRetailPriceCents!)}
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => handleFill(data.bundleRetailPriceCents!, 'retail')}>
                        {filledButton === 'retail' ? <Check size={14} weight="bold" /> : 'Fill'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-semantic-text-secondary">New retail</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-semantic-text-primary">
                      {formatCentsToCurrency(retailPriceCents!)}
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => handleFill(retailPriceCents!, 'retail')}>
                      {filledButton === 'retail' ? <Check size={14} weight="bold" /> : 'Fill'}
                    </Button>
                  </div>
                </div>
              )}
              {attributionUrl && <BgpAttribution url={attributionUrl} />}
            </>
          )}

          {hasLowest && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-semantic-text-secondary">Lowest on STG</span>
              <span className="tabular-nums text-semantic-text-primary">
                {formatCentsToCurrency(marketplace.lowestActiveCents!)}
                {marketplace.lowestIsAuction && (
                  <span className="text-semantic-text-muted ml-1">(current bid)</span>
                )}
                <span className="text-semantic-text-muted ml-1">
                  ({marketplace.activeListingCount} active)
                </span>
              </span>
            </div>
          )}

          {hasMedian && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-semantic-text-secondary">Median sold here</span>
              <span className="tabular-nums text-semantic-text-primary">
                {formatCentsToCurrency(marketplace.medianSoldCents!)}
                <span className="text-semantic-text-muted ml-1">
                  ({marketplace.completedSaleCount} sales)
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Suggested price (derived from retail × condition multiplier) — shown
          after the inputs so the math reads top-down. */}
      {suggestedPriceCents && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-semantic-text-secondary">
              {isAuction ? 'Suggested starting bid' : 'Suggested price'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-bold tabular-nums text-semantic-text-primary">
                {formatCentsToCurrency(suggestedPriceCents)}
              </span>
              <Button variant="primary" size="sm" onClick={() => handleFill(suggestedPriceCents, 'suggested')}>
                {filledButton === 'suggested' ? <Check size={14} weight="bold" /> : 'Use price'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-semantic-text-muted">
            {multiplierPct}% of {effectiveRetailCents ? formatCentsToCurrency(effectiveRetailCents) : 'retail'} ({conditionLabel})
            {isAuction && ' × 30% auction start'}
            {hasBundle && data?.gamesWithRetailData != null && data?.totalGames != null && data.gamesWithRetailData < data.totalGames && (
              <span> · Retail price based on {data.gamesWithRetailData} of {data.totalGames} games</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// BGP ToS requires attribution to boardgameprices.co.uk, not the individual shop.
// Scoped to retail rows only — STG marketplace data (lowest/median) is our own.
function BgpAttribution({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-semantic-text-muted sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom pt-1"
    >
      <span>via</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- partner logo, kept consistent with TrustBand */}
      <img
        src="/images/bgp-icon.png"
        alt="BoardGamePrices"
        width={16}
        height={16}
        className="h-4 w-auto"
      />
      <span>BoardGamePrices.co.uk</span>
      <ArrowSquareOut size={11} />
    </a>
  );
}
