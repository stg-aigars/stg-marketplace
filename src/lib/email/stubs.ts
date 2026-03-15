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
