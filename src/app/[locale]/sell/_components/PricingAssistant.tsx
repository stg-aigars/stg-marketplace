'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Lightbulb, ArrowSquareOut, Check } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Button, Skeleton } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { apiFetch } from '@/lib/api-fetch';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { conditionConfig } from '@/lib/condition-config';
import {
  calculateSuggestedPrice,
  CONDITION_MULTIPLIERS,
  MIN_SALES_FOR_MEDIAN,
  type PriceSuggestionResponse,
} from '@/lib/pricing/suggestions';
import type { ListingCondition } from '@/lib/listings/types';

interface PricingAssistantProps {
  bggGameId: number | null;
  condition: ListingCondition | null;
  isAuction: boolean;
  onFillPrice: (cents: number) => void;
  expansionIds?: number[];
}

export function PricingAssistant({
  bggGameId,
  condition,
  isAuction,
  onFillPrice,
  expansionIds = [],
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
      <Card className="mb-4">
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <Skeleton className="h-8 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </CardBody>
      </Card>
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

  const conditionLabel = conditionConfig[conditionToBadgeKey[condition]].label;
  const multiplierPct = Math.round(CONDITION_MULTIPLIERS[condition] * 100);

  return (
    <Card className="mb-4">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} weight="fill" className="text-semantic-brand shrink-0" />
          <h4 className="text-sm font-semibold text-semantic-text-heading">Price guide</h4>
        </div>

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
              {isAuction && ' \u00d7 30% auction start'}
              {hasBundle && data?.gamesWithRetailData != null && data?.totalGames != null && data.gamesWithRetailData < data.totalGames && (
                <span> · Retail price based on {data.gamesWithRetailData} of {data.totalGames} games</span>
              )}
            </p>
          </div>
        )}

        {(hasRetail || hasLowest || hasMedian) && (
          <div className="space-y-2 rounded-lg bg-semantic-bg-surface px-3 py-2.5">
            <p className="text-xs font-medium text-semantic-text-muted uppercase tracking-wide">
              Market context
            </p>

            {hasRetail && (
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

            {/* BGP ToS requires attribution to boardgameprices.co.uk, not the individual shop */}
            {attributionUrl && (
              <div className="pt-1 border-t border-semantic-border-subtle">
                <a
                  href={attributionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-semantic-text-muted hover:text-semantic-brand inline-flex items-center gap-1 transition-colors duration-250 ease-out-custom"
                >
                  via BoardGamePrices.co.uk
                  <ArrowSquareOut size={12} />
                </a>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
