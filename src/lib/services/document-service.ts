/**
 * Document data service — fetches and validates order data for document pages.
 * Access control: each function checks role (buyer/seller/staff) and order status.
 *
 * Sequential invoice numbering: INV-2026-00001, CN-2026-00001
 * Assigned at order completion (invoices) and refund (credit notes).
 * See src/lib/services/invoicing.ts and supabase/migrations/073_sequential_invoicing.sql.
 */

import { getOrder } from '@/lib/services/orders';
import type { OrderWithDetails } from '@/lib/orders/types';

interface SellerDocumentData {
  order: OrderWithDetails;
  sellerName: string;
  sellerCountry: string;
}

interface ConfirmationData {
  order: OrderWithDetails;
  buyerName: string;
  sellerName: string;
}

/**
 * Commission invoice data (seller + staff).
 * Requires order status: completed or refunded.
 */
export async function getCommissionInvoiceData(
  orderId: string,
  userId: string,
  isStaff: boolean,
): Promise<SellerDocumentData | null> {
  const order = await getOrder(orderId);
  if (!order) return null;

  // Access: seller or staff
  if (order.seller_id !== userId && !isStaff) return null;

  // Only completed or refunded orders have invoices
  if (!['completed', 'refunded'].includes(order.status)) return null;

  return {
    order,
    sellerName: order.seller_profile?.full_name ?? 'Unknown',
    sellerCountry: order.seller_country,
  };
}

/**
 * Order confirmation data (buyer + staff).
 * Only for completed or refunded orders (orders that were paid and fulfilled).
 */
export async function getOrderConfirmationData(
  orderId: string,
  userId: string,
  isStaff: boolean,
): Promise<ConfirmationData | null> {
  const order = await getOrder(orderId);
  if (!order) return null;

  // Access: buyer or staff
  if (order.buyer_id !== userId && !isStaff) return null;

  // Only completed or refunded orders have confirmations
  if (!['completed', 'refunded'].includes(order.status)) return null;

  return {
    order,
    buyerName: order.buyer_profile?.full_name ?? 'Unknown',
    sellerName: order.seller_profile?.full_name ?? 'Unknown',
  };
}

/**
 * Credit note data (seller + staff).
 * Only for refunded orders.
 */
export async function getCreditNoteData(
  orderId: string,
  userId: string,
  isStaff: boolean,
): Promise<SellerDocumentData | null> {
  const order = await getOrder(orderId);
  if (!order) return null;

  // Access: seller or staff
  if (order.seller_id !== userId && !isStaff) return null;

  // Only refunded orders have credit notes
  if (order.status !== 'refunded') return null;

  return {
    order,
    sellerName: order.seller_profile?.full_name ?? 'Unknown',
    sellerCountry: order.seller_country,
  };
}
