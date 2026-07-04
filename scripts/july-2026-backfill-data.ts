/**
 * July 2026 backfill — data table (PARTIAL — first pass).
 *
 * This is NOT the full July backfill. It posts only the two order
 * completions that were already known and deferred from the June backfill
 * (STG-20260627-XK5D and STG-20260624-E93F — paid in June, completing in
 * July) because their absence was visibly breaking the staff wallet-integrity
 * dashboard: both sellers' real wallet balances already reflect these
 * completions (the marketplace-side wallet ledger updates live, independent
 * of GL), so GL 5351 was understating the true balance by exactly their
 * combined seller_net (€18.00 + €27.00 = €45.00).
 *
 * The FULL July backfill — UJRJ's still-in-transit €34.10 card settlement,
 * any new July marketplace activity, vendor invoices, withdrawals, and July's
 * own P.1 close — is separate, later work. This file will be EXTENDED (not
 * replaced) when that happens; entry numbers here (1, 2) are reserved and
 * should not be reused.
 *
 * Source of truth: orders table (queried 2026-07-05).
 *   - STG-20260627-XK5D: seller Kārlis (da426099, LV), item €20.00 + ship
 *     €2.10, invoice INV-2026-00027, completed 2026-07-02. First-ever
 *     completion for this seller — counterparty resolves dynamically.
 *   - STG-20260624-E93F: seller Silvos (d508c35a, EE), item €30.00 + ship
 *     €3.20, invoice INV-2026-00028, completed 2026-07-04. Seller already has
 *     a counterparty from June (NKZF).
 *
 * Both orders' cart-payment legs already posted in the June backfill
 * (entries 53 and 51 respectively) — only the completions are missing.
 */

import './_load-env';

import type { PostingEvent } from '@/lib/accounting/types';

export interface BackfillEntry {
  readonly entry_number: string;
  readonly description: string;
  readonly event: PostingEvent;
  readonly sellerUserId?: string;
}

export interface BackfillCounterparty {
  readonly id: string;
  readonly type: 'vendor' | 'seller';
  readonly user_id: string | null;
  readonly full_name: string;
  readonly country: string;
  readonly tax_status: 'private' | 'vat_registered' | null;
  readonly vat_number: string | null;
  readonly vies_verified_at: string | null;
  readonly vendor_code: string | null;
  readonly legal_compliance_status: 'ok';
}

// No new vendor counterparties this pass.
export const BACKFILL_COUNTERPARTIES: readonly BackfillCounterparty[] = [];

const SOURCE_DOC_TYPE_ORDER = 'order';

const XK5D_ID = '5ee961af-ad8c-4080-b64e-5ae160ed9ff4';
const E93F_ID = '2147e415-837b-4480-8935-8c07095ea3e1';

const KARLIS_USER_ID = 'da426099-5fdd-4a35-a802-e6fc905714f9';
const SILVOS_USER_ID = 'd508c35a-0a91-4a3d-b645-c6ab204893a8';

function tag(entry_number: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    july_2026_entry_number: entry_number,
    ...extras
  };
}

export const BACKFILL_ENTRIES: readonly BackfillEntry[] = [
  // 2026-07-02: XK5D completion (O.1 LV) — Kārlis (first completion, new seller)
  {
    entry_number: '1',
    description: 'XK5D completion €22.10 — LV B2C; June-paid, July-completing order',
    sellerUserId: KARLIS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_1',
      posting_date: '2026-07-02',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260627-XK5D — LV B2C completion (item €20.00 + ship €2.10 = €22.10); cart paid 27.06 (June backfill entry 53), completes in July',
      payload: tag('1', {
        order_id: XK5D_ID,
        order_number: 'STG-20260627-XK5D',
        invoice_number: 'INV-2026-00027',
        consumption_ms: 'LV',
        item_value_cents: 2000,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-07-04: E93F completion (O.5 EE B2C OSS) — Silvos
  {
    entry_number: '2',
    description: 'E93F completion €33.20 — EE B2C OSS; June-paid (hybrid bank+wallet), July-completing order',
    sellerUserId: SILVOS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_2',
      posting_date: '2026-07-04',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260624-E93F — EE B2C OSS completion (item €30.00 + ship €3.20 = €33.20); cart paid 24.06 (June backfill entry 51, hybrid bank+wallet), completes in July',
      payload: tag('2', {
        order_id: E93F_ID,
        order_number: 'STG-20260624-E93F',
        invoice_number: 'INV-2026-00028',
        consumption_ms: 'EE',
        item_value_cents: 3000,
        shipping_value_cents: 320
      })
    }
  }
];

export const TOTAL_BACKFILL_ENTRIES = 2;
if (BACKFILL_ENTRIES.length !== TOTAL_BACKFILL_ENTRIES) {
  throw new Error(
    `july-2026-backfill-data.ts: expected ${TOTAL_BACKFILL_ENTRIES} BACKFILL_ENTRIES, ` +
    `got ${BACKFILL_ENTRIES.length}. Update TOTAL_BACKFILL_ENTRIES + the reconcile checkpoints together.`
  );
}
