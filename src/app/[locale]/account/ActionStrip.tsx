import Link from 'next/link';
import { WarningCircle } from '@phosphor-icons/react/ssr';
import { Alert } from '@/components/ui';
import type { PendingActions } from '@/lib/services/pending-actions';
import { getTotalPendingCount } from '@/lib/services/pending-actions';

// TODO: i18n — replace hardcoded English strings with next-intl keys using ICU plural syntax

interface ActionChip {
  count: number;
  label: string;
  href: string;
}

function buildChips(actions: PendingActions): { seller: ActionChip[]; buyer: ActionChip[] } {
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

interface ActionStripProps {
  actions: PendingActions;
}

export function ActionStrip({ actions }: ActionStripProps) {
  if (getTotalPendingCount(actions) === 0) return null;

  const { seller, buyer } = buildChips(actions);
  const hasBothGroups = seller.length > 0 && buyer.length > 0;

  return (
    <Alert variant="warning" icon={WarningCircle} className="mb-6">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
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
    </Alert>
  );
}
