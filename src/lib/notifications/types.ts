/** All notification type keys. Prefix determines icon + category in UI. */
export type NotificationType =
  // Order lifecycle
  | 'order.created'
  | 'order.accepted'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.delivered_seller'
  | 'order.completed'
  | 'order.declined'
  | 'order.auto_cancelled'
  | 'order.reminder.response'
  | 'order.reminder.shipping'
  | 'order.reminder.delivery'
  | 'order.escalated'
  | 'order.message_received'
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
  | 'shipping.scanned_seller'
  | 'shipping.returning'
  // Auctions
  | 'auction.bid_placed'
  | 'auction.outbid'
  | 'auction.ending_soon'
  | 'auction.won'
  | 'auction.won_seller'
  | 'auction.lost'
  | 'auction.ended_no_bids'
  | 'auction.payment_reminder'
  | 'auction.payment_expired'
  | 'auction.payment_expired_seller'
  // Wanted listings
  | 'wanted.listing_matched'
  // DAC7 tax reporting
  | 'dac7.approaching'
  | 'dac7.data_requested'
  | 'dac7.reminder'
  | 'dac7.blocked'
  | 'dac7.report_available';

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
  commenterName?: string;
  senderName?: string;
  buyerName?: string;
  sellerName?: string;
  reason?: string;
  role?: 'buyer' | 'seller';
  terminalName?: string;
  hoursRemaining?: number;
  daysRemaining?: number;
}
