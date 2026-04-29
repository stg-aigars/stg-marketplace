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
import { OrderShippedSeller } from './templates/order-shipped-seller';
import { ShippingInstructionsSeller } from './templates/shipping-instructions-seller';
import { OrderAcceptedBuyer } from './templates/order-accepted-buyer';
import { OrderDeliveredBuyer } from './templates/order-delivered-buyer';
import { OrderDeliveredSeller } from './templates/order-delivered-seller';
import { OrderCompletedSeller } from './templates/order-completed-seller';
import { OrderDeclinedBuyer } from './templates/order-declined-buyer';
import { OrderDisputedSeller } from './templates/order-disputed-seller';
import { DisputeResolvedRefund } from './templates/dispute-resolved-refund';
import { DisputeResolvedNoRefund } from './templates/dispute-resolved-no-refund';
import { DisputeEscalated } from './templates/dispute-escalated';
import { DisputeWithdrawn } from './templates/dispute-withdrawn';
import { SellerResponseReminder } from './templates/seller-response-reminder';
import { OrderAutoCancelled } from './templates/order-auto-cancelled';
import { ShippingReminderSeller } from './templates/shipping-reminder-seller';
import { DeliveryReminderBuyer } from './templates/delivery-reminder-buyer';
import { WantedListingMatched } from './templates/wanted-listing-matched';
import { AuctionBidReceived } from './templates/auction-bid-received';
import { AuctionOutbid } from './templates/auction-outbid';
import { AuctionEndingSoon } from './templates/auction-ending-soon';
import { AuctionWon } from './templates/auction-won';
import { AuctionWonSeller } from './templates/auction-won-seller';
import { AuctionLost } from './templates/auction-lost';
import { AuctionEndedNoBids } from './templates/auction-ended-no-bids';
import { AuctionPaymentReminder } from './templates/auction-payment-reminder';
import { AuctionPaymentExpired } from './templates/auction-payment-expired';
import { Dac7Approaching } from './templates/dac7-approaching';
import { Dac7DataRequested } from './templates/dac7-data-requested';
import { Dac7Reminder } from './templates/dac7-reminder';
import { Dac7Blocked } from './templates/dac7-blocked';
import { Dac7ReportAvailable } from './templates/dac7-report-available';
import { SellerVerificationRequest } from './templates/seller-verification-request';
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
  // Phase 8: durable-medium delivery (PTAC §5.1, ECJ C-49/11)
  buyerCountry: string | null;
  termsVersion: string;
  sellerTermsVersion: string;
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
      buyerCountry: params.buyerCountry,
      termsVersion: params.termsVersion,
      sellerTermsVersion: params.sellerTermsVersion,
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
 * Order shipped notification → seller (auto-ship via PARCEL_RECEIVED)
 */
export async function sendOrderShippedToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  terminalName?: string;
  terminalCountry?: string;
  isCrossBorder: boolean;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Parcel picked up — ${params.orderNumber}`,
    react: React.createElement(OrderShippedSeller, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      buyerName: params.buyerName,
      terminalName: params.terminalName,
      terminalCountry: params.terminalCountry,
      isCrossBorder: params.isCrossBorder,
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
 * Order delivered notification → seller (buyer picked up parcel)
 */
export async function sendOrderDeliveredToSeller(params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Delivered: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderDeliveredSeller, {
      sellerName: params.sellerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      buyerName: params.buyerName,
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
  paymentMethod?: string | null;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Order update: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderDeclinedBuyer, {
      buyerName: params.buyerName,
      orderNumber: params.orderNumber,
      orderId: params.orderId,
      gameName: params.gameName,
      paymentMethod: params.paymentMethod,
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
  paymentMethod?: string | null;
  staffNotes?: string;
}): Promise<void> {
  const shared = {
    orderNumber: params.orderNumber,
    orderId: params.orderId,
    gameName: params.gameName,
    refundAmountCents: params.refundAmountCents,
    paymentMethod: params.paymentMethod,
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
  paymentMethod?: string | null;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `Order cancelled: ${params.gameName} — ${params.orderNumber}`,
    react: React.createElement(OrderAutoCancelled, {
      recipientName: params.buyerName, orderNumber: params.orderNumber,
      orderId: params.orderId, gameName: params.gameName,
      reason: params.reason, variant: 'buyer', paymentMethod: params.paymentMethod, appUrl: env.app.url,
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
// Wanted listing matched emails
// ============================================================================

export async function sendWantedListingMatchedToBuyer(params: {
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  gameName: string;
  priceCents: number;
  condition: string;
  listingEdition: string | null;
  buyerEditionPreference: string | null;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.buyerEmail,
    subject: `${params.gameName} you're looking for was just listed`,
    react: React.createElement(WantedListingMatched, {
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

export async function sendAuctionEndingSoon(params: {
  recipientName: string;
  recipientEmail: string;
  gameName: string;
  listingId: string;
}): Promise<void> {
  await sendEmail({
    to: params.recipientEmail,
    subject: `${params.gameName} auction ends in 30 minutes`,
    react: React.createElement(AuctionEndingSoon, {
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
      checkoutUrl: `${env.app.url}/checkout/${params.listingId}`,
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
      checkoutUrl: `${env.app.url}/checkout/${params.listingId}`,
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

// ============================================================================
// DAC7 tax reporting emails
// ============================================================================

export async function sendDac7Approaching(params: {
  sellerName: string;
  sellerEmail: string;
  transactionCount: number;
  considerationEuros: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: 'Approaching EU tax reporting threshold',
    react: React.createElement(Dac7Approaching, {
      sellerName: params.sellerName,
      transactionCount: params.transactionCount,
      considerationEuros: params.considerationEuros,
      appUrl: env.app.url,
    }),
  });
}

export async function sendDac7DataRequested(params: {
  sellerName: string;
  sellerEmail: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: 'Action required: Tax reporting information needed',
    react: React.createElement(Dac7DataRequested, {
      sellerName: params.sellerName,
      appUrl: env.app.url,
    }),
  });
}

export async function sendDac7Reminder(params: {
  sellerName: string;
  sellerEmail: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: 'Final reminder: Tax reporting information needed — account restriction in 14 days',
    react: React.createElement(Dac7Reminder, {
      sellerName: params.sellerName,
      appUrl: env.app.url,
    }),
  });
}

export async function sendDac7Blocked(params: {
  sellerName: string;
  sellerEmail: string;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: 'Your Second Turn Games account has been restricted',
    react: React.createElement(Dac7Blocked, {
      sellerName: params.sellerName,
      appUrl: env.app.url,
    }),
  });
}

export async function sendDac7ReportAvailable(params: {
  sellerName: string;
  sellerEmail: string;
  year: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: `Your annual tax report for ${params.year} is ready for review`,
    react: React.createElement(Dac7ReportAvailable, {
      sellerName: params.sellerName,
      year: params.year,
      appUrl: env.app.url,
    }),
  });
}

export async function sendSellerVerificationRequest(params: {
  sellerFirstName: string;
  sellerEmail: string;
  salesCount: number;
  responseDeadlineDays: number;
}): Promise<void> {
  await sendEmail({
    to: params.sellerEmail,
    subject: 'A quick question about your selling on Second Turn Games',
    react: React.createElement(SellerVerificationRequest, {
      sellerFirstName: params.sellerFirstName,
      salesCount: params.salesCount,
      responseDeadlineDays: params.responseDeadlineDays,
      appUrl: env.app.url,
    }),
  });
}
