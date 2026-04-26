import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { createTestServiceClient } from '../helpers/supabase';
import { createTestUser, createTestListing, createTestOrder, cleanupTestData } from '../helpers/factories';

const supabase = createTestServiceClient();
const CONTAINER = 'supabase_db_stg-marketplace';

function dbExec(sql: string) {
  execSync(`docker exec ${CONTAINER} psql -U postgres -d postgres -c "${sql}"`, { stdio: 'pipe' });
}

describe('invoice numbering', () => {
  beforeEach(() => {
    // Reset sequences and invoices before each test for isolation
    dbExec('TRUNCATE invoices CASCADE; DELETE FROM document_sequences;');
  });

  afterEach(async () => {
    dbExec('TRUNCATE invoices CASCADE; DELETE FROM document_sequences;');
    await cleanupTestData();
  });

  async function createCompletedOrder() {
    const buyer = await createTestUser({ fullName: 'Buyer' });
    const seller = await createTestUser({ fullName: 'Seller' });
    const listing = await createTestListing({ sellerId: seller.id, priceCents: 2000 });
    const order = await createTestOrder({
      buyerId: buyer.id,
      sellerId: seller.id,
      items: [{ listingId: listing.id, priceCents: 2000 }],
      status: 'completed',
    });
    return order;
  }

  it('assigns sequential invoice numbers', async () => {
    const order1 = await createCompletedOrder();
    const order2 = await createCompletedOrder();
    const order3 = await createCompletedOrder();

    const { data: num1 } = await supabase.rpc('issue_document_number', {
      p_order_id: order1.id, p_type: 'invoice',
    });
    const { data: num2 } = await supabase.rpc('issue_document_number', {
      p_order_id: order2.id, p_type: 'invoice',
    });
    const { data: num3 } = await supabase.rpc('issue_document_number', {
      p_order_id: order3.id, p_type: 'invoice',
    });

    const year = new Date().getFullYear();
    expect(num1).toBe(`INV-${year}-00001`);
    expect(num2).toBe(`INV-${year}-00002`);
    expect(num3).toBe(`INV-${year}-00003`);
  });

  it('is idempotent — duplicate call returns same number', async () => {
    const order = await createCompletedOrder();

    const { data: first } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'invoice',
    });
    const { data: second } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'invoice',
    });

    expect(first).toBe(second);

    const { data: invoices } = await supabase
      .from('invoices').select('id').eq('order_id', order.id).eq('type', 'invoice');
    expect(invoices).toHaveLength(1);
  });

  it('credit note requires reference_invoice_id', async () => {
    const order = await createCompletedOrder();

    const { error } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'credit_note', p_reference_invoice_id: null,
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain('reference_invoice_id');
  });

  it('credit note references original invoice', async () => {
    const order = await createCompletedOrder();

    const { data: invoiceNum } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'invoice',
    });

    const { data: invoice } = await supabase
      .from('invoices').select('id').eq('order_id', order.id).eq('type', 'invoice').single();

    const { data: cnNum } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'credit_note', p_reference_invoice_id: invoice!.id,
    });

    const year = new Date().getFullYear();
    expect(invoiceNum).toBe(`INV-${year}-00001`);
    expect(cnNum).toBe(`CN-${year}-00001`);

    const { data: cn } = await supabase
      .from('invoices').select('reference_invoice_id').eq('order_id', order.id).eq('type', 'credit_note').single();
    expect(cn!.reference_invoice_id).toBe(invoice!.id);
  });

  it('concurrent calls for different orders produce unique numbers', async () => {
    const orders = await Promise.all(
      Array.from({ length: 10 }, () => createCompletedOrder())
    );

    const results = await Promise.allSettled(
      orders.map((order) =>
        supabase.rpc('issue_document_number', { p_order_id: order.id, p_type: 'invoice' })
      )
    );

    const numbers = results
      .filter((r): r is PromiseFulfilledResult<PostgrestSingleResponse<string>> => r.status === 'fulfilled')
      .map((r) => r.value.data!);

    // All 10 should succeed
    expect(numbers).toHaveLength(10);

    // All unique
    const unique = new Set(numbers);
    expect(unique.size).toBe(10);

    // Sequential (but order may vary due to concurrency) — check the counter
    const { data: seq } = await supabase
      .from('document_sequences').select('last_number').eq('type', 'invoice').single();
    expect(seq!.last_number).toBe(10);
  });

  it('UNIQUE (order_id, type) prevents duplicate invoices', async () => {
    const order = await createCompletedOrder();

    const { error: err1 } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'invoice',
    });
    expect(err1).toBeNull();

    // Idempotent — returns existing
    const { data: num2, error: err2 } = await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'invoice',
    });
    expect(err2).toBeNull();
    expect(num2).toBeTruthy();

    const { data: rows } = await supabase
      .from('invoices').select('id').eq('order_id', order.id).eq('type', 'invoice');
    expect(rows).toHaveLength(1);
  });

  it('denormalizes invoice_number onto orders table', async () => {
    const order = await createCompletedOrder();

    await supabase.rpc('issue_document_number', {
      p_order_id: order.id, p_type: 'invoice',
    });

    const { data: updated } = await supabase
      .from('orders').select('invoice_number').eq('id', order.id).single();

    const year = new Date().getFullYear();
    expect(updated!.invoice_number).toBe(`INV-${year}-00001`);
  });
});
