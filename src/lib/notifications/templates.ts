/**
 * Centralized notification copy.
 * All titles, bodies, and links live here — integration sites just call notify(type, ctx).
 * Copy changes are a single-file edit.
 */

import type { NotificationType, NotificationContext } from './types';

interface NotificationTemplate {
  title: (ctx: NotificationContext) => string;
  body: (ctx: NotificationContext) => string;
  link: (ctx: NotificationContext) => string | null;
}

function orderLink(ctx: NotificationContext) {
  return ctx.orderId ? `/orders/${ctx.orderId}` : null;
}

function offerLink() {
  return '/account/offers';
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // --- Order lifecycle ---
  'order.created': {
    title: (ctx) => ctx.role === 'buyer' ? 'Order confirmed' : 'New order',
    body: (ctx) => ctx.role === 'buyer'
      ? `Your order for ${ctx.gameName ?? 'a game'} has been confirmed`
      : `You have a new order for ${ctx.gameName ?? 'a game'}`,
    link: orderLink,
  },
  'order.accepted': {
    title: () => 'Order accepted',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} has been accepted`,
    link: orderLink,
  },
  'order.shipped': {
    title: () => 'Order shipped',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} has been shipped`,
    link: orderLink,
  },
  'order.delivered': {
    title: () => 'Delivery confirmed',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} has been delivered`,
    link: orderLink,
  },
  'order.completed': {
    title: () => 'Order completed',
    body: (ctx) => `Order for ${ctx.gameName ?? 'a game'} is complete — earnings credited to your wallet`,
    link: orderLink,
  },
  'order.declined': {
    title: () => 'Order declined',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} was declined by the seller. Your payment will be refunded.`,
    link: orderLink,
  },
  'order.auto_cancelled': {
    title: () => 'Order cancelled',
    body: (ctx) => ctx.reason === 'shipping_timeout'
      ? `Your order for ${ctx.gameName ?? 'a game'} was cancelled because it was not shipped in time`
      : `Your order for ${ctx.gameName ?? 'a game'} was automatically cancelled`,
    link: orderLink,
  },
  'order.reminder.response': {
    title: () => 'Respond to order',
    body: (ctx) => `You have ${ctx.hoursRemaining ?? 24} hours left to respond to an order for ${ctx.gameName ?? 'a game'}`,
    link: orderLink,
  },
  'order.reminder.shipping': {
    title: () => 'Ship your order',
    body: (ctx) => `You have ${ctx.daysRemaining ?? 2} days left to ship ${ctx.gameName ?? 'a game'}`,
    link: orderLink,
  },
  'order.reminder.delivery': {
    title: () => 'Confirm delivery',
    body: (ctx) => `Have you picked up ${ctx.gameName ?? 'your parcel'}? Please confirm delivery.`,
    link: orderLink,
  },
  'order.escalated': {
    title: () => 'Order escalated',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} has been escalated for review`,
    link: orderLink,
  },

  // --- Messages ---
  'message.received': {
    title: () => 'New message',
    body: (ctx) => `${ctx.senderName ?? 'Someone'} sent you a message about ${ctx.gameName ?? 'a listing'}`,
    link: (ctx) => ctx.conversationId ? `/messages/${ctx.conversationId}` : '/messages',
  },

  // --- Offers ---
  'offer.received': {
    title: () => 'New offer',
    body: (ctx) => `${ctx.buyerName ?? 'A buyer'} made an offer on ${ctx.gameName ?? 'your game'}`,
    link: offerLink,
  },
  'offer.countered': {
    title: () => 'Offer countered',
    body: (ctx) => `${ctx.sellerName ?? 'The seller'} countered your offer for ${ctx.gameName ?? 'a game'}`,
    link: offerLink,
  },
  'offer.accepted': {
    title: () => 'Offer accepted',
    body: (ctx) => `Your offer for ${ctx.gameName ?? 'a game'} has been accepted`,
    link: offerLink,
  },
  'offer.declined': {
    title: () => 'Offer declined',
    body: (ctx) => `Your offer for ${ctx.gameName ?? 'a game'} was declined`,
    link: offerLink,
  },
  'offer.expired': {
    title: () => 'Offer expired',
    body: (ctx) => `Your offer for ${ctx.gameName ?? 'a game'} has expired`,
    link: offerLink,
  },
  'offer.deadline_expired': {
    title: () => 'Listing deadline expired',
    body: (ctx) => `The seller did not list ${ctx.gameName ?? 'the game'} within the deadline`,
    link: offerLink,
  },
  'offer.superseded': {
    title: () => 'Offer superseded',
    body: (ctx) => `${ctx.gameName ?? 'The game'} has been listed independently — your offer is no longer active`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : offerLink(),
  },
  'offer.listing_created': {
    title: () => 'Game listed from your offer',
    body: (ctx) => `${ctx.gameName ?? 'The game'} is now listed and ready to buy at your agreed price`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : offerLink(),
  },

  // --- Disputes ---
  'dispute.opened': {
    title: () => 'Dispute opened',
    body: (ctx) => `A dispute has been opened on your order for ${ctx.gameName ?? 'a game'}`,
    link: orderLink,
  },
  'dispute.withdrawn': {
    title: () => 'Dispute withdrawn',
    body: (ctx) => `The dispute on your order for ${ctx.gameName ?? 'a game'} has been withdrawn`,
    link: orderLink,
  },
  'dispute.resolved': {
    title: () => 'Dispute resolved',
    body: (ctx) => `The dispute on your order for ${ctx.gameName ?? 'a game'} has been resolved`,
    link: orderLink,
  },
  'dispute.escalated': {
    title: () => 'Dispute escalated',
    body: (ctx) => `The dispute on your order for ${ctx.gameName ?? 'a game'} has been escalated for staff review`,
    link: orderLink,
  },

  // --- Shipping ---
  'shipping.instructions': {
    title: () => 'Shipping instructions',
    body: (ctx) => `Drop off ${ctx.gameName ?? 'your parcel'} at the terminal — check your order for details`,
    link: orderLink,
  },
};
