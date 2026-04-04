/** All notification type keys. Prefix determines icon + category in UI. */
export type NotificationType =
  // Order lifecycle
  | 'order.created'
  | 'order.accepted'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.completed'
  | 'order.declined'
  | 'order.auto_cancelled'
  | 'order.reminder.response'
  | 'order.reminder.shipping'
  | 'order.reminder.delivery'
  | 'order.escalated'
  // Comments
  | 'comment.received'
  // Offers
  | 'offer.received'
  | 'offer.countered'
  | 'offer.accepted'
  | 'offer.declined'
  | 'offer.expired'
  | 'offer.deadline_expired'
  | 'offer.superseded'
  | 'offer.listing_created'
  // Disputes
  | 'dispute.opened'
  | 'dispute.withdrawn'
  | 'dispute.resolved'
  | 'dispute.escalated'
  // Shipping
  | 'shipping.instructions'
  | 'shipping.scanned'
  // Auctions
  | 'auction.bid_placed'
  | 'auction.outbid'
  | 'auction.won'
  | 'auction.lost'
  | 'auction.ended_no_bids'
  | 'auction.payment_reminder'
  | 'auction.payment_expired'
  // Wanted listings
  | 'wanted.offer_received'
  | 'wanted.offer_countered'
  | 'wanted.offer_accepted'
  | 'wanted.offer_declined'
  | 'wanted.offer_expired'
  | 'wanted.listing_created'
  | 'wanted.filled';

/** Row shape from the notifications table */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/** Context object passed to notification templates */
export interface NotificationContext {
  gameName?: string;
  orderNumber?: string;
  orderId?: string;
  offerId?: string;
  listingId?: string;
  conversationId?: string;
  senderName?: string;
  commenterName?: string;
  commentId?: string;
  buyerName?: string;
  sellerName?: string;
  reason?: string;
  role?: 'buyer' | 'seller';
  terminalName?: string;
  hoursRemaining?: number;
  daysRemaining?: number;
}
