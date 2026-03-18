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
import { NewMessage } from './templates/new-message';
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
