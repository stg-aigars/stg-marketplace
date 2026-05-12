/**
 * April 2026 backfill — data table.
 *
 * Eleven journal entries reconstructing STG's marketplace + vendor GL activity
 * for April 2026 ahead of the PVN deklarācija filing deadline (20 May 2026):
 * 9 marketplace+vendor entries + 1 depreciation + 1 P.1 VAT consolidation
 * close. Continues the chain established by `phase0-backfill-data.ts`
 * (Phase 0 closed 31.03.2026 hard-locked). Source-of-truth: round 2 preamble
 * 12.05.2026 (TB signed off by user; see commit message of the runner).
 *
 * Entry numbering convention:
 *   - `april_2026_entry_<N>` for N=1..9: marketplace + vendor activity
 *   - `phase0_entry_21`: April depreciation (P.6, month 3 of 36) —
 *     continues the Phase 0 monthly-depreciation chain (Entries 19, 20 in
 *     phase0-backfill-data.ts were Feb + Mar). User-confirmed naming so the
 *     future depreciation cron can take over from N=22 onward.
 *   - `close_2026_04`: April P.1 VAT consolidation (clears 5710-LV-IN +
 *     5710-LV-OUT, books €0.30 net refund to 2380). Mirrors Phase 0's
 *     `close_2026_01` convention (less the `phase0_close_` prefix; future
 *     monthly closes continue `close_2026_05`, `close_2026_06`, …).
 *
 * Audit queries `WHERE source_doc_id LIKE 'april_2026_entry_%'` catch the 9
 * marketplace/vendor entries; `source_doc_id = 'phase0_entry_21'` catches
 * the depreciation; `source_doc_id = 'close_2026_04'` catches the P.1.
 * `posting_context.backfill = true` is set on all 11 entries so PR #4
 * trial-balance / P&L views can filter and so audit queries stay cheap.
 *
 * Conventions established here (carry forward to May 2026 backfill +
 * PR #4b vendor-invoice intake):
 *   1. Two-entry vendor invoice pattern: receipt (I.1/I.3) Cr 5310-XX, then
 *      separate I.7 payment Dr 5310-XX / Cr 2610. Even when both legs fall
 *      in the same period (Hetzner E1+E2 do; Unisend E9+May-payment don't).
 *   2. BL-rail cart receipts via C.2: event_type='everypay.payment_confirmed',
 *      payment_method='bank_link'. Required posting_context keys: cart_payment_id,
 *      everypay_payment_id (sourced from cart_checkout_groups.everypay_payment_reference).
 *   3. Seller counterparty lazy-create: counterparties.user_id FK is to
 *      auth.users(id) ON DELETE SET NULL. Both April sellers' auth.users rows
 *      exist (anonymize-not-delete pattern per account_deletion_architecture.md),
 *      so we set user_id to the real auth.users.id. full_name mirrors
 *      user_profiles.full_name exactly ("Aigars Grēniņš" for the LV seller,
 *      "Deleted User" for the anonymized EE seller). legal_compliance_status='ok'
 *      preserves the historical state at withdrawal completion time (E8 KYC
 *      gate fires naturally via the engine; 'ok' lets it through).
 *
 *      Historical note: an earlier draft of this file framed both sellers as
 *      "deleted" with user_id=null, based on a misread of an empty
 *      user_profiles SELECT result that itself was poisoned by a prior failed
 *      query in the same transaction. Production journal entries for E4 + E6 + E8
 *      retain the legacy posting_context.deleted_seller_user_id key from that
 *      draft (immutable per journal_entries trigger); the constants below still
 *      drive that key for re-run idempotency parity with production. The
 *      counterparty rows themselves were corrected via DB UPDATE on 2026-05-12.
 */

import './_load-env';

import { SYSTEM_COUNTERPARTY } from '@/lib/accounting/system-counterparties';
import type { PostingEvent } from '@/lib/accounting/types';

// ---------------------------------------------------------------------------
// BackfillEntry — wrapper around PostingEvent with metadata for the runner
// ---------------------------------------------------------------------------

export interface BackfillEntry {
  /** '1'..'9' for marketplace+vendor; 'depreciation_3_of_36' for the P.6 entry */
  readonly entry_number: string;
  /** Human-readable line description for log output */
  readonly description: string;
  /** Pre-built PostingEvent ready for emit() */
  readonly event: PostingEvent;
}

// ---------------------------------------------------------------------------
// BackfillCounterparty — superset of Phase 0's (adds 'seller' type)
// ---------------------------------------------------------------------------

export interface BackfillCounterparty {
  readonly id: string;
  readonly type: 'vendor' | 'seller';
  /**
   * Real auth.users.id for sellers (FK target is auth.users, not user_profiles).
   * Null for vendors (no user linkage). The counterparty seed UPSERT writes
   * this directly to counterparties.user_id.
   */
  readonly user_id: string | null;
  readonly full_name: string;
  readonly country: string;
  readonly tax_status: 'private' | 'vat_registered' | null;
  readonly vat_number: string | null;
  readonly vies_verified_at: string | null;
  readonly vendor_code: string | null;
  readonly legal_compliance_status: 'ok';
}

// Deterministic UUIDs. Vendors continue Phase 0's `a` prefix; seller CPs use
// a `d` prefix with the user_id's first 8 chars embedded for trace-from-UUID.
// (The `d` prefix was a relic of the earlier "deleted-seller" framing; kept
// for production stability since these UUIDs are already on journal_lines.)
const HETZNER_CP_ID = 'a8888888-8888-4888-8888-888888888888';
const UNISEND_CP_ID = 'a9999999-9999-4999-8999-999999999999';
const EE_SELLER_CP_ID = 'dce90524-0000-4000-8854-ce905240ee01';  // ce905240… EE (anonymized)
// UUID must be all valid hex (0-9a-f); embeds 630f6e7f's distinctive bytes
// in blocks 1 and 5 for traceability. Block 4 starts with '9' (valid v4 variant).
const LV_SELLER_CP_ID = 'd630f6e7-0000-4000-95cb-630f6e7f1001';

// Real auth.users.id values. counterparty.user_id FK is to auth.users (ON
// DELETE SET NULL); both rows exist (anonymize-not-delete per
// account_deletion_architecture.md), so we link directly. The
// posting_context.deleted_seller_user_id key on entries 4/6/8 retains these
// values for production parity (the key name is a legacy misnomer from the
// earlier draft; the data itself is correct).
const USER_ID_EE_SELLER = 'ce905240-8088-4854-85cd-e515ba30372e';
const USER_ID_LV_SELLER = '630f6e7f-95cb-41fa-a98f-a4d199aa32fe';

export const BACKFILL_COUNTERPARTIES: readonly BackfillCounterparty[] = [
  {
    // Entry 1 + 2: Hetzner I.3 EU B2B RC + I.7 payment
    id: HETZNER_CP_ID,
    type: 'vendor',
    user_id: null,
    full_name: 'Hetzner Online GmbH',
    country: 'DE',
    tax_status: 'vat_registered',
    vat_number: 'DE812871812',
    vies_verified_at: null,
    vendor_code: 'HE',
    legal_compliance_status: 'ok'
  },
  {
    // Entry 9: Unisend I.1 LV standard VAT (May payment forward-flagged)
    id: UNISEND_CP_ID,
    type: 'vendor',
    user_id: null,
    full_name: 'Unisend Latvia SIA',
    country: 'LV',
    tax_status: 'vat_registered',
    vat_number: 'LV40203523445',
    vies_verified_at: null,
    vendor_code: 'UN',
    legal_compliance_status: 'ok'
  },
  {
    // Entries 4 + 8: HVFJ O.5 + ce905240 C.4 withdrawal.
    // ce905240 is an anonymized test account (auth.users.email pattern
    // `deleted-…@deleted.local`); user_profiles.full_name = "Deleted User".
    id: EE_SELLER_CP_ID,
    type: 'seller',
    user_id: USER_ID_EE_SELLER,
    full_name: 'Deleted User',
    country: 'EE',
    tax_status: 'private',
    vat_number: null,
    vies_verified_at: null,
    vendor_code: null,
    legal_compliance_status: 'ok'
  },
  {
    // Entry 6: 9UC5 O.1 — LV seller.
    // 630f6e7f is Aigars's real auth account (auth.users.email
    // `aigars.grenins@gmail.com`); user_profiles.full_name = "Aigars Grēniņš".
    // €0.90 wallet balance is a real obligation from the 9UC5 order completion.
    id: LV_SELLER_CP_ID,
    type: 'seller',
    user_id: USER_ID_LV_SELLER,
    full_name: 'Aigars Grēniņš',
    country: 'LV',
    tax_status: 'private',
    vat_number: null,
    vies_verified_at: null,
    vendor_code: null,
    legal_compliance_status: 'ok'
  }
];

// ---------------------------------------------------------------------------
// Constants pulled from Supabase pre-execution verification (round 2 preamble)
// ---------------------------------------------------------------------------

export const SOURCE_DOC_TYPE_ORDER = 'order';
export const SOURCE_DOC_TYPE_CART_PAYMENT = 'cart_payment';
export const SOURCE_DOC_TYPE_VENDOR_INVOICE = 'vendor_invoice';
export const SOURCE_DOC_TYPE_VENDOR_PAYMENT = 'vendor_payment';
export const SOURCE_DOC_TYPE_BANK_FEE = 'bank_fee';
export const SOURCE_DOC_TYPE_WITHDRAWAL = 'withdrawal_request';
export const SOURCE_DOC_TYPE_DEPRECIATION = 'monthly_depreciation';

// HVFJ — EE seller (now deleted), buyer-LV → seller-EE listing → LV terminal
const HVFJ_ORDER_ID = '0dcfed09-1fe8-4f6e-9569-4079963359ec';
const HVFJ_INVOICE_NUMBER = 'INV-2026-00001';
const HVFJ_CART_ID = '9661e4f0-32b5-4efa-ae33-6bcd8027dbf9';
const HVFJ_EVERYPAY_REF = '9a9e81d70fa95c9a69cb9270b05b690a250d887e58ae53f7d920cad7e376aca4';

// 9UC5 — LV seller (now deleted), buyer-EE → seller-LV listing → EE terminal
const NINE_UC5_ORDER_ID = '6b8f2d8b-d7b1-4e9c-a625-0d14871d79e1';
const NINE_UC5_INVOICE_NUMBER = 'INV-2026-00002';
const NINE_UC5_CART_ID = 'b7612c47-a34a-4b30-9372-c4c19a2ab1a6';
const NINE_UC5_EVERYPAY_REF = '4b4c984a2165d59243056b352c22f1414e02f206164f38c2a16ac6aff4f2f87e';

// WD-2026-00001 — ce905240 EE seller's only April withdrawal (€0.90)
const WD_REQUEST_ID = '9db0fd86-710d-4990-9cbe-e2f50ca015b6';
const WD_REFERENCE_NUMBER = 'WD-2026-00001';
const WD_SELLER_IBAN = 'LV71HABA0551043117373';

// ---------------------------------------------------------------------------
// Helpers — used inline below to keep individual entries short
// ---------------------------------------------------------------------------

/** Common tag injected into every entry's payload (becomes posting_context). */
function tag(entry_number: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    april_2026_entry_number: entry_number,
    ...extras
  };
}

/** Variant for the P.6 depreciation entry — uses phase0_entry_number for chain continuity. */
function phase0DepreciationTag(entry_number: number, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    phase0_entry_number: String(entry_number),
    ...extras
  };
}

// ---------------------------------------------------------------------------
// BACKFILL_ENTRIES — 10 emits in posting-date order
// ---------------------------------------------------------------------------

export const BACKFILL_ENTRIES: readonly BackfillEntry[] = [
  // -------------------------------------------------------------------------
  // 2026-04-04: Hetzner I.3 EU B2B RC invoice receipt
  // -------------------------------------------------------------------------
  {
    entry_number: '1',
    description: 'Hetzner Online GmbH €1.91 — EU B2B RC (DE supplier; LV self-assesses 21% VAT)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'april_2026_entry_1',
      posting_date: '2026-04-04',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'Hetzner invoice 084000791607 €1.91 — EU B2B RC (Article 196 of Directive 2006/112/EC); LV self-assessment at 21%',
      counterparty_id: HETZNER_CP_ID,
      payload: tag('1', {
        invoice_net_cents: 191,
        invoice_vat_cents: 0,
        expense_account: '7730',
        vat_treatment: 'eu_b2b_rc',
        vendor_invoice_number: '084000791607',
        vendor_vat_number: 'DE812871812',
        vendor_country: 'DE',
        invoice_date: '2026-04-04'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-07: Hetzner I.7 payment settlement
  // -------------------------------------------------------------------------
  {
    entry_number: '2',
    description: 'Hetzner payment €1.91 — Swedbank → Hetzner (settles invoice 084000791607)',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'april_2026_entry_2',
      posting_date: '2026-04-07',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'Hetzner payment €1.91 — Swedbank outbound debit (settles invoice 084000791607)',
      counterparty_id: HETZNER_CP_ID,
      payload: tag('2', {
        payment_cents: 191,
        payable_account: '5310-HE',
        vendor_invoice_number: '084000791607',
        bank_value_date: '2026-04-07'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-15: HVFJ C.2 cart receipt (BL-rail, direct to Swedbank)
  // -------------------------------------------------------------------------
  {
    entry_number: '3',
    description: 'HVFJ cart payment €4.20 — BL-rail receipt to Swedbank (suspense pending completion)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'april_2026_entry_3',
      posting_date: '2026-04-15',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'HVFJ cart €4.20 — BL-rail (PIS) direct to Swedbank; suspense pending order completion',
      payload: tag('3', {
        payment_method: 'bank_link',
        gross_cart_cents: 420,
        cart_payment_id: HVFJ_CART_ID,
        everypay_payment_id: HVFJ_EVERYPAY_REF
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-20: HVFJ O.5 order completion (EE B2C OSS, 24%)
  // -------------------------------------------------------------------------
  {
    entry_number: '4',
    description: 'HVFJ order completion €4.20 — EE B2C OSS (24%; commission+shipping VAT routes to 5712)',
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'april_2026_entry_4',
      posting_date: '2026-04-20',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: `HVFJ STG-20260415-HVFJ — EE B2C OSS completion (item €1.00 + ship €3.20 = €4.20 gross_cart; seller_net €0.90; VAT €0.64 to OSS-EE)`,
      counterparty_id: EE_SELLER_CP_ID,
      payload: tag('4', {
        order_id: HVFJ_ORDER_ID,
        order_number: 'STG-20260415-HVFJ',
        seller_id: EE_SELLER_CP_ID,
        invoice_number: HVFJ_INVOICE_NUMBER,
        consumption_ms: 'EE',
        item_value_cents: 100,
        shipping_value_cents: 320,
        deleted_seller_user_id: USER_ID_EE_SELLER
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-15: 9UC5 C.2 cart receipt (BL-rail)
  // -------------------------------------------------------------------------
  {
    entry_number: '5',
    description: '9UC5 cart payment €3.10 — BL-rail receipt to Swedbank (suspense pending completion)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'april_2026_entry_5',
      posting_date: '2026-04-15',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: '9UC5 cart €3.10 — BL-rail (PIS) direct to Swedbank; suspense pending order completion',
      payload: tag('5', {
        payment_method: 'bank_link',
        gross_cart_cents: 310,
        cart_payment_id: NINE_UC5_CART_ID,
        everypay_payment_id: NINE_UC5_EVERYPAY_REF
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-20: 9UC5 O.1 order completion (LV B2C, 21%)
  // -------------------------------------------------------------------------
  {
    entry_number: '6',
    description: '9UC5 order completion €3.10 — LV B2C (21%; commission+shipping VAT routes to 5710-LV-OUT)',
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'april_2026_entry_6',
      posting_date: '2026-04-20',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: `9UC5 STG-20260415-9UC5 — LV B2C completion (item €1.00 + ship €2.10 = €3.10 gross_cart; seller_net €0.90; VAT €0.38 to 5710-LV-OUT)`,
      counterparty_id: LV_SELLER_CP_ID,
      payload: tag('6', {
        order_id: NINE_UC5_ORDER_ID,
        order_number: 'STG-20260415-9UC5',
        seller_id: LV_SELLER_CP_ID,
        invoice_number: NINE_UC5_INVOICE_NUMBER,
        consumption_ms: 'LV',
        item_value_cents: 100,
        shipping_value_cents: 210,
        deleted_seller_user_id: USER_ID_LV_SELLER
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-16: Swedbank POS DAR I.5 fee
  // -------------------------------------------------------------------------
  {
    entry_number: '7',
    description: 'Swedbank POS DAR €0.08 — VAT-exempt card-acquiring per-transaction fee (PVN likums Article 52)',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'april_2026_entry_7',
      posting_date: '2026-04-16',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'Swedbank POS DAR €0.08 — card-acquiring per-transaction fee (PVN likums Article 52 exempt)',
      payload: tag('7', {
        fee_cents: 8,
        vendor: 'swedbank',
        fee_type: 'pos_terminal',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-20: HVFJ seller C.4 withdrawal (KYC gate fires; legal_compliance_status='ok' passes)
  // -------------------------------------------------------------------------
  {
    entry_number: '8',
    description: 'WD-2026-00001 €0.90 — HVFJ seller (ce905240) wallet withdrawal to AIGARS GRĒNIŅŠ IBAN',
    event: {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: SOURCE_DOC_TYPE_WITHDRAWAL,
      source_doc_id: 'april_2026_entry_8',
      posting_date: '2026-04-20',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'WD-2026-00001 €0.90 — HVFJ seller wallet withdrawal (KYC gate static-OK for pre-deletion historical state)',
      counterparty_id: EE_SELLER_CP_ID,
      payload: tag('8', {
        withdrawal_cents: 90,
        seller_id: EE_SELLER_CP_ID,
        withdrawal_ref: WD_REFERENCE_NUMBER,
        withdrawal_request_id: WD_REQUEST_ID,
        seller_iban: WD_SELLER_IBAN,
        bank_value_date: '2026-04-20',
        deleted_seller_user_id: USER_ID_EE_SELLER
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-30: Unisend I.1 invoice receipt (May payment forward-flagged)
  // -------------------------------------------------------------------------
  {
    entry_number: '9',
    description: 'Unisend invoice 2601206 €3.90 — LV standard VAT 21% (€3.22 net shipping + €0.68 input VAT)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'april_2026_entry_9',
      posting_date: '2026-04-30',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'Unisend invoice 2601206 €3.90 — 2 parcels (HVFJ EE→LV + 9UC5 LV→EE); LV standard VAT 21%; payment forward-flagged to May 2026 backfill',
      counterparty_id: UNISEND_CP_ID,
      payload: tag('9', {
        invoice_net_cents: 322,
        invoice_vat_cents: 68,
        expense_account: '7720',
        vat_treatment: 'standard',
        vendor_invoice_number: '2601206',
        vendor_vat_number: 'LV40203523445',
        invoice_date: '2026-04-30',
        // payable_account defaults to '5310-UN' via vendor_code='UN' — no override.
        // May payment forward-flagged: NOT posted here; lands in scripts/may-2026-backfill.ts
        // as a separate I.7 entry on 2026-05-08 (Dr 5310-UN €3.90 / Cr 2610 €3.90).
        forward_flag_may_payment: true,
        forward_flag_may_payment_date: '2026-05-08'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-30: April depreciation (P.6, month 3 of 36)
  // Continues the Phase 0 monthly-depreciation chain (Entries 19, 20 in
  // phase0-backfill-data.ts were Feb + Mar). source_doc_id continues the
  // 'phase0_entry_<N>' pattern at N=21; future depreciation cron starts at N=22.
  // -------------------------------------------------------------------------
  {
    entry_number: 'depreciation_3_of_36',
    description: 'April depreciation €41.98 — MacBook Pro 14" (month 3 of 36; continues phase0_entry chain at N=21)',
    event: {
      event_type: 'cron.monthly_depreciation',
      source_doc_type: SOURCE_DOC_TYPE_DEPRECIATION,
      source_doc_id: 'phase0_entry_21',
      posting_date: '2026-04-30',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'Monthly depreciation IT-2026-001 €41.98 (month 3 of 36; continues phase0_entry chain)',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: phase0DepreciationTag(21, {
        depreciation_cents: 4198,
        asset_code: 'IT-2026-001',
        month_number: 3,
        of_total: 36
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-04-30: April P.1 VAT consolidation (refund position)
  // Clears 5710-LV-IN €0.68 (Unisend input) + 5710-LV-OUT €0.38 (9UC5 output);
  // books net €0.30 refund receivable to 2380. Mirrors Phase 0's close_2026_01
  // shape. Foreign RC pair (5710-RC-IN/OUT) NOT cleared — stays on balance
  // sheet long-term per Phase 0 convention.
  // -------------------------------------------------------------------------
  {
    entry_number: 'close_2026_04',
    description: 'April 2026 VAT consolidation — €0.30 refund due from VID',
    event: {
      // event_type renamed from 'period_close.monthly_refund' →
      // 'period_close.monthly_vat' in PR C commit 12 (direction-agnostic
      // routing to support both refund and payable positions). The April
      // backfill's already-posted prod entry was emitted under the legacy
      // name; this script's reference now uses the new name so the script
      // continues to dispatch correctly if re-run (event_type isn't
      // persisted to journal_entries — only type_id='P.1' is — so the
      // historical prod entry is unaffected by the rename).
      event_type: 'period_close.monthly_vat',
      source_doc_type: 'period_close',
      source_doc_id: 'close_2026_04',
      posting_date: '2026-04-30',
      accounting_period: '2026-04',
      tax_period: '2026-04',
      narrative: 'April 2026 VAT consolidation — clears 5710-LV-IN €0.68 + 5710-LV-OUT €0.38; net refund €0.30 to 2380',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('close_2026_04', {
        closing_period: '2026-04',
        net_refund_cents: 30,
        lines: [
          {
            account_code: '5710-LV-OUT',
            debit_cents: 38,
            credit_cents: 0,
            narrative: 'Clear LV output VAT — 9UC5 (April close)'
          },
          {
            account_code: '5710-LV-IN',
            debit_cents: 0,
            credit_cents: 68,
            narrative: 'Clear LV input VAT — Unisend (April close)'
          },
          {
            account_code: '2380',
            debit_cents: 30,
            credit_cents: 0,
            narrative: 'VID receivable — April 2026 PVN deklarācija refund position'
          }
        ]
      })
    }
  }
];

// ---------------------------------------------------------------------------
// Sanity assertion: 11 emits expected (9 marketplace+vendor + 1 depreciation
// + 1 P.1 close).
// ---------------------------------------------------------------------------
export const TOTAL_BACKFILL_ENTRIES = 11;
if (BACKFILL_ENTRIES.length !== TOTAL_BACKFILL_ENTRIES) {
  throw new Error(
    `april-2026-backfill-data.ts: expected ${TOTAL_BACKFILL_ENTRIES} BACKFILL_ENTRIES, ` +
    `got ${BACKFILL_ENTRIES.length}. If you added/removed an entry, update ` +
    `TOTAL_BACKFILL_ENTRIES + the reconciliation harness checkpoints.`
  );
}
