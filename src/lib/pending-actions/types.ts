export interface PendingActions {
  sellerOrdersPending: number;
  sellerOrdersToShip: number;
  sellerDisputes: number;
  buyerDisputes: number;
  buyerDeliveryConfirm: number;
  buyerAuctionsWon: number;
  isSeller: boolean;
}

export function getTotalPendingCount(actions: PendingActions): number {
  return (
    actions.sellerOrdersPending +
    actions.sellerOrdersToShip +
    actions.sellerDisputes +
    actions.buyerDisputes +
    actions.buyerDeliveryConfirm +
    actions.buyerAuctionsWon
  );
}

// TODO: i18n — replace hardcoded English strings with next-intl keys using ICU plural syntax

export interface ActionChip {
  count: number;
  label: string;
  href: string;
}

export function buildActionChips(actions: PendingActions): { seller: ActionChip[]; buyer: ActionChip[] } {
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
  if (actions.buyerAuctionsWon > 0) {
    buyer.push({
      count: actions.buyerAuctionsWon,
      label: actions.buyerAuctionsWon === 1 ? 'auction won — pay now' : 'auctions won — pay now',
      href: '/account/orders?tab=purchases',
    });
  }

  return { seller, buyer };
}
