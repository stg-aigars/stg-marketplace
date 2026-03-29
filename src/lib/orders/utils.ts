/**
 * Order utility helpers
 */

/**
 * Produce a human-readable summary of game names for an order.
 * Single item: "Catan"
 * Multiple items: "Catan + 2 more"
 */
export function orderGameSummary(items: Array<{ gameName: string }>): string {
  if (items.length === 0) return 'Game';
  if (items.length === 1) return items[0].gameName;
  return `${items[0].gameName} + ${items.length - 1} more`;
}

/** Shape of order_items as returned by Supabase joins */
interface OrderItemLike {
  listing_id: string;
  price_cents?: number;
  listings?: { game_name: string; seller_id?: string } | null;
}

/** Shape of the legacy listings join on orders */
interface LegacyListingsLike {
  game_name: string;
  seller_id?: string;
}

/**
 * Get game name summary from an order's items, falling back to legacy listings join.
 * Use this instead of manually mapping order_items into orderGameSummary.
 */
export function getOrderGameSummary(
  orderItems: OrderItemLike[] | undefined,
  legacyListings: LegacyListingsLike | null | undefined
): string {
  if (orderItems && orderItems.length > 0) {
    return orderGameSummary(
      orderItems.map((i) => ({ gameName: i.listings?.game_name ?? 'Game' }))
    );
  }
  return legacyListings?.game_name ?? 'Game';
}

/**
 * Get all listing IDs from an order's items, falling back to legacy listing_id.
 */
export function getOrderListingIds(
  orderItems: OrderItemLike[] | undefined,
  legacyListingId: string | null | undefined
): string[] {
  if (orderItems && orderItems.length > 0) {
    return orderItems.map((i) => i.listing_id);
  }
  return legacyListingId ? [legacyListingId] : [];
}
