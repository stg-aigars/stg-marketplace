/**
 * Email functions
 *
 * Real implementations for priority emails (Week 1).
 * Remaining functions are no-op stubs until their templates are built.
 */

import React from 'react';
import { sendEmail } from './service';
import { NewOrderSeller } from './templates/new-order-seller';
import { OrderConfirmationBuyer } from './templates/order-confirmation-buyer';
import { OrderShippedBuyer } from './templates/order-shipped-buyer';
import { env } from '@/lib/env';

// ─── Week 1: Real implementations ───────────────────────────────────────────

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

// ─── Stubs: not yet implemented ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendShippingLabelToSeller(_params: {
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
  // No-op stub
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendOrderAcceptedToBuyer(_params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  sellerName: string;
}): Promise<void> {
  // No-op stub
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendOrderDeliveredToBuyer(_params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
}): Promise<void> {
  // No-op stub
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendOrderCompletedToSeller(_params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
}): Promise<void> {
  // No-op stub
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendOrderDeclinedToBuyer(_params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
}): Promise<void> {
  // No-op stub
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendOrderDisputedToSeller(_params: {
  sellerName: string;
  sellerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  reason?: string;
}): Promise<void> {
  // No-op stub
}
