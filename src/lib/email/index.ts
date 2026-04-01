/**
 * Email functions
 *
 * All transactional email implementations for the order lifecycle.
 */

import React from 'react';
import { sendEmail } from './service';
import { NewOrderSeller } from './templates/new-order-seller';
import { OrderConfirmationBuyer } from './templates/order-confirmation-buyer';
import { OrderShippedBuyer } from './templates/order-shipped-buyer';
import { ShippingInstructionsSeller } from './templates/shipping-instructions-seller';
import { OrderAcceptedBuyer } from './templates/order-accepted-buyer';
import { OrderDeliveredBuyer } from './templates/order-delivered-buyer';
import { OrderCompletedSeller } from './templates/order-completed-seller';
import { OrderDeclinedBuyer } from './templates/order-declined-buyer';
import { OrderDisputedSeller } from './templates/order-disputed-seller';
import { DisputeResolvedRefund } from './templates/dispute-resolved-refund';
import { DisputeResolvedNoRefund } from './templates/dispute-resolved-no-refund';
import { DisputeEscalated } from './templates/dispute-escalated';
import { DisputeWithdrawn } from './templates/dispute-withdrawn';
import { NewMessage } from './templates/new-message';
import { OfferReceived } from './templates/offer-received';
import { OfferCountered } from './templates/offer-countered';
import { OfferAccepted } from './templates/offer-accepted';
import { OfferDeclined } from './templates/offer-declined';
import { OfferExpired } from './templates/offer-expired';
import { OfferDeadlineExpired } from './templates/offer-deadline-expired';
import { OfferSuperseded } from './templates/offer-superseded';
import { OfferListingCreated } from './templates/offer-listing-created';
import { SellerResponseReminder } from './templates/seller-response-reminder';
import { OrderAutoCancelled } from './templates/order-auto-cancelled';
import { ShippingReminderSeller } from './templates/shipping-reminder-seller';
import { DeliveryReminderBuyer } from './templates/delivery-reminder-buyer';
import { WantedOfferReceived } from './templates/wanted-offer-received';
import { AuctionBidReceived } from './templates/auction-bid-received';
import { AuctionOutbid } from './templates/auction-outbid';
import { AuctionWon } from './templates/auction-won';
import { AuctionWonSeller } from './templates/auction-won-seller';
import { AuctionLost } from './templates/auction-lost';
import { AuctionEndedNoBids } from './templates/auction-ended-no-bids';
import { AuctionPaymentReminder } from './templates/auction-payment-reminder';
import { AuctionPaymentExpired } from './templates/auction-payment-expired';
import { WantedOfferCountered } from './templates/wanted-offer-countered';
import { WantedOfferAccepted } from './templates/wanted-offer-accepted';
import { WantedOfferDeclined } from './templates/wanted-offer-declined';
import { WantedOfferExpired } from './templates/wanted-offer-expired';
import { WantedListingCreated } from './templates/wanted-listing-created';
import { env } from '@/lib/env';

/**
 * New order notification → seller (when order is created after payment)
 */
export async function sendNewOrderToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  priceCents: number;
  shippingCents: number;
  terminalName: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `New order: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(NewOrderSeller, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      buyerName: params.buyerName,
      priceCents: params.priceCents,
      shippingCents: params.shippingCents,
      terminalName: params.terminalName,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order confirmation → buyer (after payment succeeds)
 */
export async function sendOrderConfirmationToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  sellerName: string;
  priceCents: number;
  shippingCents: number;
  terminalName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Order confirmed: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderConfirmationBuyer, {
      buyerName: params.buyerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      sellerName: params.sellerName,
      priceCents: params.priceCents,
      shippingCents: params.shippingCents,
      terminalName: params.terminalName,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order shipped notification → buyer
 */
export async function sendOrderShippedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  barcode?: string;
  trackingUrl?: string;
  terminalName?: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Shipped: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderShippedBuyer, {
      buyerName: params.buyerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      barcode: params.barcode,
      trackingUrl: params.trackingUrl,
      terminalName: params.terminalName,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Shipping instructions → seller (after parcel is created for accepted order)
 */
export async function sendShippingInstructionsToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  buyerName: string;
  destinationTerminalName: string;
  destinationTerminalAddress: string;
  parcelId: string;
  barcode?: string;
  trackingUrl?: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Shipping ready: Order ${params.orderNumber} — drop off at any Unisend terminal`,
    react: React.createElement(ShippingInstructionsSeller, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      buyerName: params.buyerName,
      destinationTerminalName: params.destinationTerminalName,
      destinationTerminalAddress: params.destinationTerminalAddress,
      parcelId: params.parcelId,
      barcode: params.barcode,
      trackingUrl: params.trackingUrl,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order accepted notification → buyer
 */
export async function sendOrderAcceptedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  sellerName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Order accepted: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderAcceptedBuyer, {
      buyerName: params.buyerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      sellerName: params.sellerName,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order delivered notification → buyer (prompts confirmation)
 */
export async function sendOrderDeliveredToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Picked up: ${params.gameName} — please confirm`,
    react: React.createElement(OrderDeliveredBuyer, {
      buyerName: params.buyerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order completed notification → seller (earnings credited)
 */
export async function sendOrderCompletedToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  earningsCents: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Order complete: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderCompletedSeller, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      buyerName: params.buyerName,
      earningsCents: params.earningsCents,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order declined notification → buyer (refund info)
 */
export async function sendOrderDeclinedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Order update: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderDeclinedBuyer, {
      buyerName: params.buyerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      appUrl: env.app.url,
    }),
  });
}

/**
 * Order disputed notification → seller (issue reported)
 */
export async function sendOrderDisputedToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  reason?: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Issue reported: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderDisputedSeller, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      buyerName: params.buyerName,
      reason: params.reason,
      appUrl: env.app.url,
    }),
  });
}

/**
 * New message notification → recipient
 */
export async function sendNewMessageNotification(params: {
  to: string;
  recipientName: string;
  senderName: string;
  gameTitle: string;
  messagePreview: string;
  conversationId: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `New message from ${params.senderName} about ${params.gameTitle}`,
    react: React.createElement(NewMessage, {
      recipientName: params.recipientName,
      senderName: params.senderName,
      gameTitle: params.gameTitle,
      messagePreview: params.messagePreview,
      conversationUrl: `${env.app.url}/messages/${params.conversationId}`,
    }),
  });
}

/**
 * Dispute resolved with refund → both buyer and seller
 */
export async function sendDisputeResolvedRefund(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  refundAmountCents: number;
  staffNotes?: string;
}): Promise<void> {
  const shared = {
    orderNumber: params.orderNumber,
    orderId: params.orderId,
    gameName: params.gameName,
    refundAmountCents: params.refundAmountCents,
    staffNotes: params.staffNotes,
    appUrl: env.app.url,
  };

  await Promise.all([
    sendEmail({
      to: params.buyerEmail,
      subject: `Dispute resolved: ${params.gameName} — ${params.orderNumber}`,
      react: React.createElement(DisputeResolvedRefund, {
        ...shared,
        recipientName: params.buyerName,
        recipientRole: 'buyer',
      }),
    }),
    sendEmail({
      to: params.sellerEmail,
      subject: `Dispute resolved: ${params.gameName} — ${params.orderNumber}`,
      react: React.createElement(DisputeResolvedRefund, {
        ...shared,
        recipientName: params.sellerName,
        recipientRole: 'seller',
      }),
    }),
  ]);
}

/**
 * Dispute resolved without refund (seller's favor) → both buyer and seller
 */
export async function sendDisputeResolvedNoRefund(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  earningsCents: number;
  staffNotes?: string;
}): Promise<void> {
  const shared = {
    orderNumber: params.orderNumber,
    orderId: params.orderId,
    gameName: params.gameName,
    earningsCents: params.earningsCents,
    staffNotes: params.staffNotes,
    appUrl: env.app.url,
  };

  await Promise.all([
    sendEmail({
      to: params.buyerEmail,
      subject: `Dispute resolved: ${params.gameName} — ${params.orderNumber}`,
      react: React.createElement(DisputeResolvedNoRefund, {
        ...shared,
        recipientName: params.buyerName,
        recipientRole: 'buyer',
      }),
    }),
    sendEmail({
      to: params.sellerEmail,
      subject: `Dispute resolved: ${params.gameName} — ${params.orderNumber}`,
      react: React.createElement(DisputeResolvedNoRefund, {
        ...shared,
        recipientName: params.sellerName,
        recipientRole: 'seller',
      }),
    }),
  ]);
}

/**
 * Dispute escalated to staff → both buyer and seller
 */
export async function sendDisputeEscalated(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
}): Promise<void> {
  const shared = {
    orderNumber: params.orderNumber,
    orderId: params.orderId,
    gameName: params.gameName,
    appUrl: env.app.url,
  };

  await Promise.all([
    sendEmail({
      to: params.buyerEmail,
      subject: `Dispute escalated: ${params.gameName} — ${params.orderNumber}`,
      react: React.createElement(DisputeEscalated, {
        ...shared,
        recipientName: params.buyerName,
      }),
    }),
    sendEmail({
      to: params.sellerEmail,
      subject: `Dispute escalated: ${params.gameName} — ${params.orderNumber}`,
      react: React.createElement(DisputeEscalated, {
        ...shared,
        recipientName: params.sellerName,
      }),
    }),
  ]);
}

/**
 * Dispute withdrawn by buyer → seller only
 */
export async function sendDisputeWithdrawn(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  earningsCents: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Dispute withdrawn: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(DisputeWithdrawn, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      buyerName: params.buyerName,
      earningsCents: params.earningsCents,
      appUrl: env.app.url,
    }),
  });
}

// ============================================================================
// Offer emails (Seller Shelves feature)
// ============================================================================

/**
 * Offer received notification → seller
 */
export async function sendOfferReceivedToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  buyerName: string;
  gameName: string;
  amountCents: number;
  note: string | null;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `New offer on ${params.gameName}`,
    react: React.createElement(OfferReceived, {
      sellerName: params.sellerName,
      buyerName: params.buyerName,
      gameName: params.gameName,
      amountCents: params.amountCents,
      note: params.note,
      offersUrl: `${env.app.url}/account/offers`,
    }),
  });
}

/**
 * Offer countered notification → buyer
 */
export async function sendOfferCounteredToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
  originalAmountCents: number;
  counterAmountCents: number;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Counter-offer on ${params.gameName}`,
    react: React.createElement(OfferCountered, {
      buyerName: params.buyerName,
      sellerName: params.sellerName,
      gameName: params.gameName,
      originalAmountCents: params.originalAmountCents,
      counterAmountCents: params.counterAmountCents,
      offersUrl: `${env.app.url}/account/offers`,
    }),
  });
}

/**
 * Offer accepted notification → both parties
 */
export async function sendOfferAccepted(params: {
  sellerName: string;
  sellerEmail: string;
  buyerName: string;
  buyerEmail: string;
  gameName: string;
  agreedAmountCents: number;
  offerId: string;
}): Promise<void> {
  await Promise.all([
    // Seller gets "Create listing" CTA
    sendEmail({
      to: params.sellerEmail,
      subject: `Offer accepted: ${params.gameName}`,
      react: React.createElement(OfferAccepted, {
        recipientName: params.sellerName,
        otherPartyName: params.buyerName,
        gameName: params.gameName,
        agreedAmountCents: params.agreedAmountCents,
        nextStepUrl: `${env.app.url}/sell/from-offer/${params.offerId}`,
        isSeller: true,
      }),
    }),
    // Buyer gets "View offers" CTA
    sendEmail({
      to: params.buyerEmail,
      subject: `Offer accepted: ${params.gameName}`,
      react: React.createElement(OfferAccepted, {
        recipientName: params.buyerName,
        otherPartyName: params.sellerName,
        gameName: params.gameName,
        agreedAmountCents: params.agreedAmountCents,
        nextStepUrl: `${env.app.url}/account/offers`,
        isSeller: false,
      }),
    }),
  ]);
}

/**
 * Offer declined notification → buyer
 */
export async function sendOfferDeclinedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Offer update: ${params.gameName}`,
    react: React.createElement(OfferDeclined, {
      buyerName: params.buyerName,
      sellerName: params.sellerName,
      gameName: params.gameName,
      offersUrl: `${env.app.url}/browse`,
    }),
  });
}

/**
 * Offer expired notification → buyer (7-day TTL)
 */
export async function sendOfferExpiredToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Offer expired: ${params.gameName}`,
    react: React.createElement(OfferExpired, {
      buyerName: params.buyerName,
      gameName: params.gameName,
      offersUrl: `${env.app.url}/account/offers`,
    }),
  });
}

/**
 * Offer deadline expired notification → buyer (seller didn't create listing in 3 days)
 */
export async function sendOfferDeadlineExpiredToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Offer expired: ${params.gameName}`,
    react: React.createElement(OfferDeadlineExpired, {
      buyerName: params.buyerName,
      sellerName: params.sellerName,
      gameName: params.gameName,
      offersUrl: `${env.app.url}/account/offers`,
    }),
  });
}

/**
 * Offer superseded notification → buyer (seller listed game independently)
 */
export async function sendOfferSupersededToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `${params.gameName} is now listed`,
    react: React.createElement(OfferSuperseded, {
      buyerName: params.buyerName,
      sellerName: params.sellerName,
      gameName: params.gameName,
      listingUrl: `${env.app.url}/listings/${params.listingId}`,
    }),
  });
}

/**
 * Listing created from accepted offer → buyer
 * Buyer gets a link to the listing so they can purchase at the agreed price.
 */
export async function sendOfferListingCreatedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  gameName: string;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `${params.gameName} is now listed and ready to buy`,
    react: React.createElement(OfferListingCreated, {
      buyerName: params.buyerName,
      gameName: params.gameName,
      listingUrl: `${env.app.url}/listings/${params.listingId}`,
    }),
  });
}

// --- Deadline enforcement emails ---

export async function sendSellerResponseReminder(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  hoursRemaining: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Reminder: Respond to order for ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(SellerResponseReminder, { ...params, appUrl: env.app.url }),
  });
}

export async function sendOrderAutoCancelledToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  reason: 'response_timeout' | 'shipping_timeout';
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Order cancelled: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderAutoCancelled, {
      recipientName: params.buyerName, orderNumber: params.orderNumber,
      orderId: params.orderId, gameName: params.gameName,
      reason: params.reason, variant: 'buyer', appUrl: env.app.url,
    }),
  });
}

export async function sendOrderAutoCancelledToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  reason: 'response_timeout' | 'shipping_timeout';
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Order cancelled: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderAutoCancelled, {
      recipientName: params.sellerName, orderNumber: params.orderNumber,
      orderId: params.orderId, gameName: params.gameName,
      reason: params.reason, variant: 'seller', appUrl: env.app.url,
    }),
  });
}

export async function sendShippingReminderToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  daysRemaining: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Reminder: Ship order for ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(ShippingReminderSeller, { ...params, appUrl: env.app.url }),
  });
}

export async function sendDeliveryReminderToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  daysSinceShipped: number;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Have you picked up your parcel? — ${params.orderNumber}`,
    react: React.createElement(DeliveryReminderBuyer, { ...params, appUrl: env.app.url }),
  });
}

// ============================================================================
// Wanted offer emails
// ============================================================================

export async function sendWantedOfferReceivedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
  condition: string;
  priceCents: number;
  note: string | null;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `New offer on your wanted game ${params.gameName}`,
    react: React.createElement(WantedOfferReceived, {
      ...params,
      wantedUrl: `${env.app.url}/account/wanted`,
    }),
  });
}

export async function sendWantedOfferCounteredToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  buyerName: string;
  gameName: string;
  originalPriceCents: number;
  counterPriceCents: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Counter on your offer for ${params.gameName}`,
    react: React.createElement(WantedOfferCountered, {
      ...params,
      offersUrl: `${env.app.url}/account/offers`,
    }),
  });
}

export async function sendWantedOfferAccepted(params: {
  sellerName: string;
  sellerEmail: string;
  buyerName: string;
  buyerEmail: string;
  gameName: string;
  agreedPriceCents: number;
  offerId: string;
}): Promise<void> {
  await Promise.all([
    sendEmail({
      to: params.sellerEmail,
      subject: `Offer accepted — create a listing for ${params.gameName}`,
      react: React.createElement(WantedOfferAccepted, {
        recipientName: params.sellerName,
        otherPartyName: params.buyerName,
        gameName: params.gameName,
        agreedPriceCents: params.agreedPriceCents,
        isSeller: true,
        actionUrl: `${env.app.url}/sell/from-wanted-offer/${params.offerId}`,
      }),
    }),
    sendEmail({
      to: params.buyerEmail,
      subject: `Your wanted offer for ${params.gameName} was accepted`,
      react: React.createElement(WantedOfferAccepted, {
        recipientName: params.buyerName,
        otherPartyName: params.sellerName,
        gameName: params.gameName,
        agreedPriceCents: params.agreedPriceCents,
        isSeller: false,
        actionUrl: `${env.app.url}/account/wanted`,
      }),
    }),
  ]);
}

export async function sendWantedOfferDeclined(params: {
  recipientName: string;
  recipientEmail: string;
  otherPartyName: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.recipientEmail,
    subject: `Offer for ${params.gameName} was declined`,
    react: React.createElement(WantedOfferDeclined, {
      ...params,
      wantedUrl: `${env.app.url}/wanted`,
    }),
  });
}

export async function sendWantedOfferExpiredToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Your offer for ${params.gameName} has expired`,
    react: React.createElement(WantedOfferExpired, {
      ...params,
      wantedUrl: `${env.app.url}/wanted`,
    }),
  });
}

export async function sendWantedListingCreatedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `${params.gameName} is now listed and ready to buy`,
    react: React.createElement(WantedListingCreated, {
      ...params,
      listingUrl: `${env.app.url}/listings/${params.listingId}`,
    }),
  });
}

// ============================================================================
// Auction emails
// ============================================================================

export async function sendAuctionBidReceivedToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  bidderName: string;
  gameName: string;
  bidAmountCents: number;
  bidCount: number;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `New bid on ${params.gameName}`,
    react: React.createElement(AuctionBidReceived, {
      ...params,
      listingUrl: `${env.app.url}/listings/${params.listingId}`,
    }),
  });
}

export async function sendAuctionOutbidNotification(params: {
  bidderName: string;
  bidderEmail: string;
  gameName: string;
  currentBidCents: number;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.bidderEmail,
    subject: `You have been outbid on ${params.gameName}`,
    react: React.createElement(AuctionOutbid, {
      ...params,
      listingUrl: `${env.app.url}/listings/${params.listingId}`,
    }),
  });
}

export async function sendAuctionWonToWinner(params: {
  winnerName: string;
  winnerEmail: string;
  gameName: string;
  winningBidCents: number;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.winnerEmail,
    subject: `You won ${params.gameName} — pay within 24 hours`,
    react: React.createElement(AuctionWon, {
      ...params,
      checkoutUrl: `${env.app.url}/checkout/auction/${params.listingId}`,
    }),
  });
}

export async function sendAuctionWonToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  gameName: string;
  winningBidCents: number;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Your auction for ${params.gameName} has ended with a winning bid`,
    react: React.createElement(AuctionWonSeller, {
      ...params,
      listingUrl: `${env.app.url}/listings/${params.listingId}`,
    }),
  });
}

export async function sendAuctionLostNotification(params: {
  bidderName: string;
  bidderEmail: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.bidderEmail,
    subject: `The auction for ${params.gameName} has ended`,
    react: React.createElement(AuctionLost, {
      ...params,
      browseUrl: `${env.app.url}/browse`,
    }),
  });
}

export async function sendAuctionEndedNoBidsToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  gameName: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Your auction for ${params.gameName} ended with no bids`,
    react: React.createElement(AuctionEndedNoBids, {
      ...params,
      listingsUrl: `${env.app.url}/account/listings`,
    }),
  });
}

export async function sendAuctionPaymentReminderToWinner(params: {
  winnerName: string;
  winnerEmail: string;
  gameName: string;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.winnerEmail,
    subject: `12 hours left to pay for ${params.gameName}`,
    react: React.createElement(AuctionPaymentReminder, {
      ...params,
      checkoutUrl: `${env.app.url}/checkout/auction/${params.listingId}`,
    }),
  });
}

export async function sendAuctionPaymentExpired(params: {
  recipientName: string;
  recipientEmail: string;
  gameName: string;
  isSeller: boolean;
}): Promise<void> {
  await sendEmail({
    to: params.recipientEmail,
    subject: `Auction payment expired for ${params.gameName}`,
    react: React.createElement(AuctionPaymentExpired, {
      ...params,
      listingsUrl: `${env.app.url}/${params.isSeller ? 'account/listings' : 'browse'}`,
    }),
  });
}
