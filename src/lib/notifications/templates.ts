/**
 * Centralized notification copy.
 * All titles, bodies, and links live here — integration sites just call notify(type, ctx).
 * Copy changes are a single-file edit.
 *
 * Voice: see memory/feedback_voice_board_gamey.md.
 * Register: order/comment/shipping/auction/wanted = warm-specific; dispute/DAC7 = warm-factual (friction rule, no wit).
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

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // --- Order lifecycle ---
  'order.created': {
    title: (ctx) => ctx.role === 'buyer' ? 'Order confirmed' : 'New order',
    body: (ctx) => ctx.role === 'buyer'
      ? `We've got your order for ${ctx.gameName ?? 'a game'}.`
      : `A buyer placed an order for ${ctx.gameName ?? 'a game'} — check your queue.`,
    link: orderLink,
  },
  'order.accepted': {
    title: () => 'Your seller\'s in',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} is accepted — shipping next.`,
    link: orderLink,
  },
  'order.shipped': {
    title: (ctx) => `${ctx.gameName ?? 'Your game'} is on the way`,
    body: (ctx) => `The seller shipped ${ctx.gameName ?? 'your game'}. We'll let you know when it reaches the terminal.`,
    link: orderLink,
  },
  'order.delivered': {
    title: (ctx) => `${ctx.gameName ?? 'Your game'} arrived`,
    body: (ctx) => `Pick up ${ctx.gameName ?? 'your parcel'}, give it a quick check, and confirm when everything looks right.`,
    link: orderLink,
  },
  'order.delivered_seller': {
    title: (ctx) => `Buyer picked up ${ctx.gameName ?? 'the parcel'}`,
    body: (ctx) => `${ctx.buyerName ?? 'The buyer'} collected ${ctx.gameName ?? 'the game'}. Once they confirm, your earnings land.`,
    link: orderLink,
  },
  'order.completed': {
    title: (ctx) => `${ctx.gameName ?? 'Your game'} sold`,
    body: (ctx) => `Your earnings from ${ctx.gameName ?? 'the sale'} are in your wallet.`,
    link: orderLink,
  },
  'order.declined': {
    title: () => 'The seller can\'t fulfil this one',
    body: (ctx) => `Your order for ${ctx.gameName ?? 'a game'} was declined. We're refunding your payment.`,
    link: orderLink,
  },
  'order.auto_cancelled': {
    title: () => 'Order cancelled',
    body: (ctx) => ctx.reason === 'shipping_timeout'
      ? `Your order for ${ctx.gameName ?? 'a game'} wasn't shipped in time, so we cancelled it. Refund on the way.`
      : `Your order for ${ctx.gameName ?? 'a game'} was auto-cancelled. Refund on the way.`,
    link: orderLink,
  },
  'order.reminder.response': {
    title: () => 'Order waiting for you',
    body: (ctx) => `A buyer wants ${ctx.gameName ?? 'a game'} — ${ctx.hoursRemaining ?? 24} hours left to accept or decline.`,
    link: orderLink,
  },
  'order.reminder.shipping': {
    title: (ctx) => `Ship ${ctx.gameName ?? 'the game'} soon`,
    body: (ctx) => `${ctx.daysRemaining ?? 2} days left to get ${ctx.gameName ?? 'the game'} to the terminal.`,
    link: orderLink,
  },
  'order.reminder.delivery': {
    title: (ctx) => `Did ${ctx.gameName ?? 'your parcel'} arrive?`,
    body: (ctx) => `Let us know once you've picked up ${ctx.gameName ?? 'your parcel'}.`,
    link: orderLink,
  },
  'order.escalated': {
    title: () => 'Order under review',
    body: (ctx) => `We're taking a look at your order for ${ctx.gameName ?? 'a game'}.`,
    link: orderLink,
  },
  'order.message_received': {
    title: (ctx) => `${ctx.senderName ?? 'Someone'} messaged you`,
    body: (ctx) => `About order ${ctx.orderNumber ?? 'you\'re part of'}.`,
    link: orderLink,
  },

  // --- Comments ---
  'comment.received': {
    title: (ctx) => `${ctx.commenterName ?? 'Someone'} asked about ${ctx.gameName ?? 'your listing'}`,
    body: () => `A new comment's in — take a look and reply when you can.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}#comments` : null,
  },

  // --- Disputes (friction path — warm-factual, no wit) ---
  'dispute.opened': {
    title: () => 'Dispute opened',
    body: (ctx) => `A dispute has been opened on your order for ${ctx.gameName ?? 'a game'}.`,
    link: orderLink,
  },
  'dispute.withdrawn': {
    title: () => 'Dispute withdrawn',
    body: (ctx) => `The dispute on your order for ${ctx.gameName ?? 'a game'} has been withdrawn.`,
    link: orderLink,
  },
  'dispute.resolved': {
    title: () => 'Dispute resolved',
    body: (ctx) => `The dispute on your order for ${ctx.gameName ?? 'a game'} has been resolved.`,
    link: orderLink,
  },
  'dispute.escalated': {
    title: () => 'Dispute escalated',
    body: (ctx) => `The dispute on your order for ${ctx.gameName ?? 'a game'} has been escalated for staff review.`,
    link: orderLink,
  },

  // --- Shipping ---
  'shipping.instructions': {
    title: () => 'Shipping instructions',
    body: (ctx) => `Drop off ${ctx.gameName ?? 'your parcel'} at the terminal — your order page has the details.`,
    link: orderLink,
  },
  'shipping.scanned': {
    title: () => 'Parcel dropped off',
    body: (ctx) => `The seller dropped off ${ctx.gameName ?? 'your parcel'} — we'll let you know when it reaches your terminal.`,
    link: orderLink,
  },
  'shipping.scanned_seller': {
    title: () => 'Parcel on its way',
    body: (ctx) => `${ctx.gameName ?? 'The game'} is dropped off and heading to the buyer.`,
    link: orderLink,
  },
  'shipping.ready_for_pickup': {
    title: () => 'Parcel ready for pickup',
    body: (ctx) => ctx.terminalName
      ? `${ctx.gameName ?? 'Your parcel'} is waiting at ${ctx.terminalName}.`
      : `${ctx.gameName ?? 'Your parcel'} is ready to pick up.`,
    link: orderLink,
  },
  'shipping.returning': {
    title: () => 'Parcel returning to sender',
    body: (ctx) => `${ctx.gameName ?? 'The parcel'} was not collected in time and is returning to sender. A dispute has been opened.`,
    link: orderLink,
  },

  // --- Auctions ---
  'auction.bid_placed': {
    title: () => 'New bid on your auction',
    body: (ctx) => `${ctx.buyerName ?? 'Someone'} placed a bid on ${ctx.gameName ?? 'your auction'}.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : null,
  },
  'auction.outbid': {
    title: () => 'You\'ve been outbid',
    body: (ctx) => `Someone topped your bid on ${ctx.gameName ?? 'an auction you were in'}.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : null,
  },
  'auction.ending_soon': {
    title: () => 'Auction ending soon',
    body: (ctx) => `${ctx.gameName ?? 'An auction you\'re in'} ends in about 30 minutes.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : null,
  },
  'auction.lost': {
    title: () => 'Auction ended',
    body: (ctx) => `${ctx.gameName ?? 'The auction'} ended — someone else had the winning bid.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : null,
  },
  'auction.won': {
    title: (ctx) => `You won ${ctx.gameName ?? 'the auction'}`,
    body: (ctx) => `Pay within 24 hours to lock in ${ctx.gameName ?? 'the game'}.`,
    link: (ctx) => ctx.listingId ? `/checkout/${ctx.listingId}` : null,
  },
  'auction.won_seller': {
    title: (ctx) => `${ctx.gameName ?? 'Your auction'} sold`,
    body: (ctx) => `${ctx.buyerName ?? 'A buyer'} won ${ctx.gameName ?? 'your auction'} — they have 24 hours to pay.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : '/account/listings',
  },
  'auction.ended_no_bids': {
    title: () => 'Auction ended with no bids',
    body: (ctx) => `Your auction for ${ctx.gameName ?? 'a game'} ended without a bid — re-list when you\'re ready.`,
    link: () => '/account/listings',
  },
  'auction.payment_reminder': {
    title: () => 'Payment reminder',
    body: (ctx) => `12 hours left to pay for ${ctx.gameName ?? 'your winning auction'}.`,
    link: (ctx) => ctx.listingId ? `/checkout/${ctx.listingId}` : null,
  },
  'auction.payment_expired': {
    title: () => 'Auction payment expired',
    body: (ctx) => `The payment deadline for ${ctx.gameName ?? 'an auction'} has passed.`,
    link: () => '/account/bids',
  },
  'auction.payment_expired_seller': {
    title: () => 'Auction payment expired',
    body: (ctx) => `The winning bidder didn't pay for ${ctx.gameName ?? 'your auction'} in time — the auction has been cancelled and the game is yours to re-list.`,
    link: () => '/account/listings',
  },

  // --- Wanted listings ---
  'wanted.listing_matched': {
    title: () => 'A game you want was just listed',
    body: (ctx) => `${ctx.gameName ?? 'A game'} you're looking for just showed up.`,
    link: (ctx) => ctx.listingId ? `/listings/${ctx.listingId}` : '/wanted',
  },

  // --- DAC7 tax reporting (friction path — warm-factual, no wit) ---
  'dac7.approaching': {
    title: () => 'Close to the tax threshold',
    body: () => "You're getting close to the EU tax reporting threshold. We'll ask for a few details if you reach it.",
    link: () => '/account/tax',
  },
  'dac7.data_requested': {
    title: () => 'A few tax details needed',
    body: () => "You've crossed the EU tax reporting threshold. Head to tax settings to fill in the details — five minutes.",
    link: () => '/account/tax',
  },
  'dac7.reminder': {
    title: () => 'Tax details still needed',
    body: () => 'We still need your tax details. Your account will be restricted in 14 days if we don\'t have them.',
    link: () => '/account/tax',
  },
  'dac7.blocked': {
    title: () => 'Selling paused — tax details missing',
    body: () => 'New listings and withdrawals are paused until we have your tax details. Five minutes to sort.',
    link: () => '/account/tax',
  },
  'dac7.report_available': {
    title: () => 'Tax report ready',
    body: () => 'Your annual tax report is ready. Review it before we submit to the tax authority.',
    link: () => '/account/tax',
  },

  // Moderation (DSA Art. 16/17)
  'moderation.notice_received': {
    title: () => 'New DSA notice received',
    body: (ctx) =>
      ctx.listingId
        ? `Listing report (${ctx.category ?? 'unknown'})${ctx.anonymous ? ' — anonymous' : ''}`
        : `Notice received (${ctx.category ?? 'unknown'})${ctx.anonymous ? ' — anonymous' : ''}`,
    link: () => '/staff/notices',
  },
  'listing.actioned': {
    title: () => 'Action taken on your listing',
    body: (ctx) =>
      `We've acted on a notice about ${ctx.gameName ?? 'your listing'}. Reason: ${ctx.reason ?? 'see details'}.`,
    link: (ctx) => (ctx.listingId ? `/listings/${ctx.listingId}` : '/account/listings'),
  },
};
