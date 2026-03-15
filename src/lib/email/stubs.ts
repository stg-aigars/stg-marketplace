/**
 * Email stubs
 *
 * No-op async functions for email sends not yet implemented.
 * Replace with real implementations when the email service is built.
 */

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
  // No-op stub — email service not yet implemented
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
export async function sendOrderShippedToBuyer(_params: {
  buyerName: string;
  buyerEmail: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  barcode?: string;
  trackingUrl?: string;
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
