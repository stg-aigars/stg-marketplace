/**
 * Auto-completion cron endpoint.
 * Finds delivered orders past the dispute window and auto-completes them,
 * crediting the seller's wallet.
 *
 * Authenticated via Bearer token (matches expire-reservations and cleanup-sessions pattern).
 * Called every 6 hours from Coolify cron:
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/auto-complete
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { autoCompleteOrder } from '@/lib/services/order-transitions';
import { issueInvoice, issueCreditNote } from '@/lib/services/invoicing';
import { DISPUTE_WINDOW_DAYS } from '@/lib/pricing/constants';
import { env } from '@/lib/env';

const BATCH_LIMIT = 50;

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find delivered orders past the dispute window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DISPUTE_WINDOW_DAYS);

  const { data: eligibleOrders, error: queryError } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('status', 'delivered')
    .lt('delivered_at', cutoffDate.toISOString())
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error('[Cron] Auto-complete query failed:', queryError);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!eligibleOrders || eligibleOrders.length === 0) {
    return NextResponse.json({ processed: 0, errors: [] });
  }

  const results: { orderId: string; orderNumber: string; success: boolean; error?: string }[] = [];

  // Process each order independently
  for (const order of eligibleOrders) {
    try {
      await autoCompleteOrder(order.id);
      results.push({ orderId: order.id, orderNumber: order.order_number, success: true });
      console.log(`[Cron] Auto-completed order ${order.order_number}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ orderId: order.id, orderNumber: order.order_number, success: false, error: message });
      console.error(`[Cron] Failed to auto-complete order ${order.order_number}:`, message);
    }
  }

  const processed = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success).map((r) => `${r.orderNumber}: ${r.error}`);

  // Reconcile missing invoices/credit notes (idempotent — safe to retry)
  let invoicesReconciled = 0;
  const { data: missingInvoices } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'completed')
    .is('invoice_number', null)
    .limit(20);

  for (const order of missingInvoices ?? []) {
    try {
      await issueInvoice(order.id);
      invoicesReconciled++;
    } catch (err) {
      console.error(`[Cron] Failed to reconcile invoice for order ${order.id}:`, err);
    }
  }

  const { data: missingCreditNotes } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'refunded')
    .is('credit_note_number', null)
    .not('refund_status', 'is', null)
    .limit(20);

  for (const order of missingCreditNotes ?? []) {
    try {
      await issueCreditNote(order.id);
      invoicesReconciled++;
    } catch (err) {
      console.error(`[Cron] Failed to reconcile credit note for order ${order.id}:`, err);
    }
  }

  return NextResponse.json({ processed, errors, total: eligibleOrders.length, invoicesReconciled });
}
