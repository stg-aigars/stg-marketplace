'use client';

import Link from 'next/link';
import { X } from '@phosphor-icons/react/ssr';
import { usePendingActions } from '@/hooks/usePendingActions';

// TODO: i18n — replace hardcoded English strings with next-intl keys using ICU plural syntax
// e.g. {count, plural, one {# order needs response} other {# orders need response}}

interface ActionChip {
  count: number;
  label: string;
  href: string;
}

function formatChips(
  actions: NonNullable<ReturnType<typeof usePendingActions>['actions']>
): { seller: ActionChip[]; buyer: ActionChip[] } {
  const seller: ActionChip[] = [];
  const buyer: ActionChip[] = [];

  if (actions.sellerOrdersPending > 0) {
    seller.push({
      count: actions.sellerOrdersPending,
      label: actions.sellerOrdersPending === 1 ? 'order needs response' : 'orders need response',
      href: '/account/orders?tab=sales',
    });
  }
  if (actions.sellerOrdersToShip > 0) {
    seller.push({
      count: actions.sellerOrdersToShip,
      label: actions.sellerOrdersToShip === 1 ? 'order to ship' : 'orders to ship',
      href: '/account/orders?tab=sales',
    });
  }
  if (actions.sellerDisputes > 0) {
    seller.push({
      count: actions.sellerDisputes,
      label: actions.sellerDisputes === 1 ? 'dispute' : 'disputes',
      href: '/account/orders?tab=sales',
    });
  }
  if (actions.sellerOffersPending > 0) {
    seller.push({
      count: actions.sellerOffersPending,
      label: actions.sellerOffersPending === 1 ? 'offer pending' : 'offers pending',
      href: '/account/offers',
    });
  }

  if (actions.buyerDisputes > 0) {
    buyer.push({
      count: actions.buyerDisputes,
      label: actions.buyerDisputes === 1 ? 'dispute' : 'disputes',
      href: '/account/orders?tab=purchases',
    });
  }
  if (actions.buyerDeliveryConfirm > 0) {
    buyer.push({
      count: actions.buyerDeliveryConfirm,
      label: actions.buyerDeliveryConfirm === 1 ? 'delivery to confirm' : 'deliveries to confirm',
      href: '/account/orders?tab=purchases',
    });
  }
  if (actions.buyerWantedOffers > 0) {
    buyer.push({
      count: actions.buyerWantedOffers,
      label: actions.buyerWantedOffers === 1 ? 'wanted offer' : 'wanted offers',
      href: '/account/wanted',
    });
  }

  return { seller, buyer };
}

export function PendingActionsBanner() {
  const { actions, total, dismissed, dismiss } = usePendingActions();

  if (!actions || total === 0 || dismissed) return null;

  const { seller, buyer } = formatChips(actions);
  const hasBothGroups = seller.length > 0 && buyer.length > 0;

  return (
    <div className="bg-semantic-warning-bg border-b border-semantic-warning/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-sm">
        <span className="font-medium text-semantic-text-heading shrink-0">Needs attention:</span>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 flex-1 min-w-0">
          {seller.map((chip, i) => (
            <span key={chip.href + chip.label} className="inline-flex items-center">
              {i > 0 && <span className="text-semantic-text-muted mx-1">&middot;</span>}
              <Link
                href={chip.href}
                className="text-semantic-text-secondary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom underline decoration-semantic-text-muted/30 underline-offset-2"
              >
                {chip.count} {chip.label}
              </Link>
            </span>
          ))}
          {hasBothGroups && (
            <span className="text-semantic-text-muted mx-1">|</span>
          )}
          {buyer.map((chip, i) => (
            <span key={chip.href + chip.label} className="inline-flex items-center">
              {i > 0 && <span className="text-semantic-text-muted mx-1">&middot;</span>}
              <Link
                href={chip.href}
                className="text-semantic-text-secondary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom underline decoration-semantic-text-muted/30 underline-offset-2"
              >
                {chip.count} {chip.label}
              </Link>
            </span>
          ))}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded text-semantic-text-muted sm:hover:text-semantic-text-secondary transition-colors duration-250 ease-out-custom"
          aria-label="Dismiss"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
