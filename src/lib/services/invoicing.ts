/**
 * Invoice and credit note issuance.
 * Calls the atomic `issue_document_number` Postgres RPC which:
 * - Assigns sequential numbers (INV-2026-00001, CN-2026-00001)
 * - Inserts into the `invoices` table
 * - Denormalizes onto `orders.invoice_number` / `orders.credit_note_number`
 * - Is idempotent per (order_id, type)
 */

import { createServiceClient } from '@/lib/supabase';

/**
 * Issue an invoice for a completed order.
 * Idempotent — returns existing number if already issued.
 * @param issuedAt Optional override for backfill/reconciliation (derives year from this)
 */
export async function issueInvoice(orderId: string, issuedAt?: Date): Promise<string> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('issue_document_number', {
    p_order_id: orderId,
    p_type: 'invoice',
    p_issued_at: issuedAt?.toISOString() ?? null,
  });

  if (error) throw new Error(`Failed to issue invoice for order ${orderId}: ${error.message}`);
  return data as string;
}

/**
 * Issue a credit note for a refunded order.
 * Requires the invoice to exist first (issues one defensively if missing).
 * Idempotent — returns existing number if already issued.
 */
export async function issueCreditNote(orderId: string, issuedAt?: Date): Promise<string> {
  const supabase = createServiceClient();

  // Find the invoice for this order (must exist — issued at order completion)
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'invoice')
    .maybeSingle();

  if (!invoice) {
    // No invoice means the order was cancelled before completion — no credit note needed
    throw new Error(`No invoice found for order ${orderId} — credit note not applicable`);
  }

  const { data, error } = await supabase.rpc('issue_document_number', {
    p_order_id: orderId,
    p_type: 'credit_note',
    p_reference_invoice_id: invoice.id,
    p_issued_at: issuedAt?.toISOString() ?? null,
  });

  if (error) throw new Error(`Failed to issue credit note for order ${orderId}: ${error.message}`);
  return data as string;
}
