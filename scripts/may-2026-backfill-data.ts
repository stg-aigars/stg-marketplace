/**
 * May 2026 backfill — data table.
 *
 * Reconstructs STG's marketplace + vendor GL activity for May 2026 ahead of the
 * PVN deklarācija filing deadline (20 June 2026). May is the first soft-launch
 * month: the accounting engine was OFF in production (ACCOUNTING_ENGINE_ENABLED
 * =false) for the whole period, so there are no real-time GL entries for the 6
 * marketplace orders. This backfill posts them, plus the month's vendor/operational
 * activity, plus the May P.1 VAT close. Continues the chain from April
 * (`close_2026_04` hard-locked) and Phase 0.
 *
 * Source of truth:
 *   - Swedbank statements: operating account 2610 (LV89…5377 7) closing €383.78;
 *     e-commerce settlement account 2620 (LV24…4950 3) closing €149.20.
 *   - orders table (queried 2026-06-02): 6 orders created 21–31 May.
 *   - Vendor invoices: Anthropic JQYX1OS2-0011 (€90 EUR), Meta FBADS-046-*
 *     (5 invoices, €13 total), Unisend 2601206 (April invoice, May payment),
 *     Vincit VO-113703 (50% pre-term refund €35.88).
 *
 * Depreciation is NOT in this backfill: the monthly-depreciation cron already
 * posted P.6 `depreciation_IT-2026-001_2026-05` (€41.98, month 4 of 36) on
 * 2026-05-31. The May P.1 close IS here (the monthly-vat-close cron correctly
 * skipped — no engine entries existed when it fired 1 June).
 *
 * Engine types used (all require the backfill-enablement PR #394):
 *   - I.4 EUR path (Anthropic, EUR non-EU RC, no FX)
 *   - I.3 (Meta, EU B2B RC), I.7 (Unisend + Meta payments), I.5 (Swedbank
 *     exempt commission), I.1 (EveryPay VATable fees), I.8 (Vincit refund)
 *   - C.1/C.2 cart payments (bank_account override → 2620 for bank-link),
 *     C.3 settlement (settlement_bank_account → 2620), C.10 transfer, C.8 VID refund
 *   - O.1 completions (2 LV orders), P.1 close
 *
 * Marketplace cash rails: the live engine hardcodes 2610/2630, but soft-launch
 * receipts land in the new 2620 e-commerce account. The cash legs pass the
 * bank_account / settlement_bank_account override added in PR #394. (The live
 * cart wrap gets the same override in the Stage 3 cutover PR.)
 *
 * source_doc_id convention: `may_2026_entry_<N>` for N=1..18; `close_2026_05`
 * for the P.1. posting_context.backfill=true on all entries.
 */

import './_load-env';

import { SYSTEM_COUNTERPARTY } from '@/lib/accounting/system-counterparties';
import type { PostingEvent } from '@/lib/accounting/types';

export interface BackfillEntry {
  readonly entry_number: string;
  readonly description: string;
  readonly event: PostingEvent;
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

// ---------------------------------------------------------------------------
// Counterparties — only the THREE new vendors are seeded here. Unisend
// (a9999…), Vincit (a1111…) and the Aigars seller CP (d630f6e7…) already exist
// (Phase 0 / April); we reference their ids below without re-seeding so a
// mistyped field can't overwrite the live rows.
// ---------------------------------------------------------------------------

const ANTHROPIC_CP_ID = 'a2222222-2222-4222-8222-222222222222';
const META_CP_ID = 'a3333333-3333-4333-8333-333333333333';
const SWEDBANK_CP_ID = 'a4444444-4444-4444-8444-444444444444';

// Existing counterparties (NOT re-seeded — referenced only).
const UNISEND_CP_ID = 'a9999999-9999-4999-8999-999999999999';
const VINCIT_CP_ID = 'a1111111-1111-4111-8111-111111111111';
const AIGARS_SELLER_CP_ID = 'd630f6e7-0000-4000-95cb-630f6e7f1001';

export const BACKFILL_COUNTERPARTIES: readonly BackfillCounterparty[] = [
  {
    id: ANTHROPIC_CP_ID,
    type: 'vendor',
    user_id: null,
    full_name: 'Anthropic, PBC',
    country: 'US',
    tax_status: null,
    vat_number: null,
    vies_verified_at: null,
    vendor_code: 'AN',
    legal_compliance_status: 'ok'
  },
  {
    id: META_CP_ID,
    type: 'vendor',
    user_id: null,
    full_name: 'Meta Platforms Ireland Limited',
    country: 'IE',
    tax_status: 'vat_registered',
    vat_number: 'IE9692928F',
    vies_verified_at: null,
    vendor_code: 'META',
    legal_compliance_status: 'ok'
  },
  {
    id: SWEDBANK_CP_ID,
    type: 'vendor',
    user_id: null,
    full_name: 'Swedbank AS',
    country: 'LV',
    tax_status: 'vat_registered',
    vat_number: 'LV40003074764',
    vies_verified_at: null,
    vendor_code: 'SW',
    legal_compliance_status: 'ok'
  }
];

// ---------------------------------------------------------------------------
// source_doc_type constants
// ---------------------------------------------------------------------------

const SOURCE_DOC_TYPE_ORDER = 'order';
const SOURCE_DOC_TYPE_CART_PAYMENT = 'cart_payment';
const SOURCE_DOC_TYPE_VENDOR_INVOICE = 'vendor_invoice';
const SOURCE_DOC_TYPE_VENDOR_PAYMENT = 'vendor_payment';
const SOURCE_DOC_TYPE_VENDOR_REFUND = 'vendor_refund';
const SOURCE_DOC_TYPE_BANK_FEE = 'bank_fee';
const SOURCE_DOC_TYPE_BANK_TRANSFER = 'bank_transfer';
const SOURCE_DOC_TYPE_SETTLEMENT = 'everypay_settlement';
const SOURCE_DOC_TYPE_VID_REFUND = 'vid_refund';

// ---------------------------------------------------------------------------
// Order constants (orders table, queried 2026-06-02)
// ---------------------------------------------------------------------------

// Order 1 — Aigars (LV), bank-link, COMPLETED 22.05 → C.2 + O.1
const O1_ID = 'cda11d70-58c4-4a8a-8907-08f7d77d48fb';
const O1_CART = '2b536cd2-e8d2-416b-84b3-592d1125eb0a';
const O1_EVERYPAY = 'a388a70e665e23757fec5c38ce45c4948ff745eba126210c957f9fcf398dd38a';

// Order 2 — Nelle (EE), card, DELIVERED (not completed in May) → C.1 + C.3 only
const O2_ID = '51e04bad-867a-4651-8a18-14269f693bef';
const O2_CART = '2cd052af-6741-488c-8980-ec0fcd4723b3';
const O2_EVERYPAY = '2b55b1656df993b9a4f01bfd1d5abf01a16f351ebe7d1793463ae7fc670173cc';

// Order 3 — Aigars (LV), bank-link, COMPLETED 29.05 → C.2 + O.1
const O3_ID = '9b1db864-c89d-439b-862a-4f12aad90028';
const O3_CART = 'ea084cb0-904a-45d8-a1f3-7ad3494638da';
const O3_EVERYPAY = '59d833bbbe947487e329ecf862e0bf4aeababfcfcb3517177c078050749771f6';

// Order 4 — Aigars (LV), card, SHIPPED (settles June) → C.1 only
const O4_ID = '76d03960-b579-4154-bfbd-b68b2193afca';
const O4_CART = '2053bf79-df5c-4ce7-ad90-9bca9ddae496';
const O4_EVERYPAY = '9e5fe44077bdecf935b622c678b39507e8273c99b3c915d49e27d3076075c79a';

// Order 5 — Gedas (LT), bank-link, SHIPPED (completes June) → C.2 only
const O5_ID = '8bf5f297-046e-4aec-b063-730e44b01ebf';
const O5_CART = '878de41e-8ff4-4cff-99ad-17136c0e787d';
const O5_EVERYPAY = '3e8b856223ad4177f187a7b8a686bdb4a8cbb08dd64fd05e5c76ab53cea4887f';

// Order 6 — Aigars (LV), card, SHIPPED (settles June) → C.1 only
const O6_ID = '80838949-1095-4a77-bf03-3f89519bbd0d';
const O6_CART = '4c7be213-e4fe-4068-b174-501aa870cc93';
const O6_EVERYPAY = 'f0e67c279803225407b603ff19e3d70619234e5ee4c03492490cfb6576e0ac72';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tag(entry_number: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    may_2026_entry_number: entry_number,
    ...extras
  };
}

// ---------------------------------------------------------------------------
// BACKFILL_ENTRIES — 19 emits in posting-date order
// ---------------------------------------------------------------------------

export const BACKFILL_ENTRIES: readonly BackfillEntry[] = [
  // 2026-05-05: Anthropic — non-EU RC, EUR-billed (I.4 EUR path), same-day card pay to 2610
  {
    entry_number: '1',
    description: 'Anthropic €90.00 — non-EU RC, EUR-billed (Max plan); self-assess 21% RC VAT €18.90; same-day pay to 2610',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'may_2026_entry_1',
      posting_date: '2026-05-05',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Anthropic invoice JQYX1OS2-0011 €90.00 — non-EU RC (Article 44 + 196); EUR-billed, no FX; LV self-assessment 21%',
      counterparty_id: ANTHROPIC_CP_ID,
      payload: tag('1', {
        invoice_currency: 'EUR',
        invoice_net_cents: 9000,
        expense_account: '7730',
        payable_account: '2610',
        vat_treatment: 'non_eu_rc',
        vendor_invoice_number: 'JQYX1OS2-0011',
        vendor_country: 'US',
        invoice_date: '2026-05-05'
      })
    }
  },

  // 2026-05-07: Swedbank e-commerce platform commission (April fee) — VAT-exempt (I.5)
  {
    entry_number: '2',
    description: 'Swedbank e-commerce commission €0.09 — VAT-exempt financial service (April fee billed in May)',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'may_2026_entry_2',
      posting_date: '2026-05-07',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Swedbank AS e-commerce platform commission €0.09 (EPLV_SECONDTURN 04.2026) — PVN likums Article 52 exempt',
      payload: tag('2', {
        fee_cents: 9,
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-05-08: Unisend payment (I.7) — settles April invoice 2601206 (forward-flagged from April)
  {
    entry_number: '3',
    description: 'Unisend payment €3.90 — settles April invoice 2601206 (forward-flagged from April backfill)',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'may_2026_entry_3',
      posting_date: '2026-05-08',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Unisend payment €3.90 — Swedbank outbound (settles April invoice 2601206; April booked the I.1 receipt)',
      counterparty_id: UNISEND_CP_ID,
      payload: tag('3', {
        payment_cents: 390,
        payable_account: '5310-UN',
        vendor_invoice_number: '2601206',
        bank_account: '2610',
        bank_value_date: '2026-05-08'
      })
    }
  },

  // 2026-05-15: Internal transfer 2610 → 2620 (€0.72) (C.10)
  {
    entry_number: '4',
    description: 'Internal transfer €0.72 — operating (2610) → e-commerce settlement (2620)',
    event: {
      event_type: 'bank.internal_transfer',
      source_doc_type: SOURCE_DOC_TYPE_BANK_TRANSFER,
      source_doc_id: 'may_2026_entry_4',
      posting_date: '2026-05-15',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Internal transfer €0.72 — Swedbank 2610 → 2620 (funds e-commerce account)',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('4', {
        from_account: '2610',
        to_account: '2620',
        transfer_cents: 72
      })
    }
  },

  // 2026-05-15: EveryPay platform fees (account 2620) — LV standard VAT (I.1), paid same-day to 2620
  {
    entry_number: '5',
    description: 'EveryPay platform fees €0.72 (€0.60 net + €0.12 LV VAT) — processing + payment-initiation commission, debited from 2620',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'may_2026_entry_5',
      posting_date: '2026-05-15',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Swedbank e-commerce platform fees €0.72 — transaction processing €0.40 + payment-initiation commission €0.20 + 21% LV VAT €0.12; paid from 2620',
      counterparty_id: SWEDBANK_CP_ID,
      payload: tag('5', {
        invoice_net_cents: 60,
        invoice_vat_cents: 12,
        expense_account: '7710',
        payable_account: '2620',
        vat_treatment: 'standard',
        vendor_invoice_number: 'swedbank-ecom-2026-05',
        vendor_vat_number: 'LV40003074764',
        invoice_date: '2026-05-15'
      })
    }
  },

  // 2026-05-21: Order 1 cart payment (C.2 bank-link → 2620)
  {
    entry_number: '6',
    description: 'Order 1 (STG-20260521-R62J) cart €21.90 — bank-link receipt direct to 2620; suspense pending completion',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'may_2026_entry_6',
      posting_date: '2026-05-21',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260521-R62J cart €21.90 — bank-link (PIS) to 2620; suspense pending completion',
      payload: tag('6', {
        payment_method: 'bank_link',
        gross_cart_cents: 2190,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: O1_ID,
        cart_payment_id: O1_CART,
        everypay_payment_id: O1_EVERYPAY
      })
    }
  },

  // 2026-05-22: Order 1 completion (O.1 LV B2C, 21%)
  {
    entry_number: '7',
    description: 'Order 1 completion €21.90 — LV B2C (21%); seller_net €18.00, commission+shipping VAT €0.68 to 5710-LV-OUT',
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'may_2026_entry_7',
      posting_date: '2026-05-22',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260521-R62J — LV B2C completion (item €20.00 + ship €1.90 = €21.90; seller_net €18.00; VAT €0.68 to 5710-LV-OUT)',
      counterparty_id: AIGARS_SELLER_CP_ID,
      payload: tag('7', {
        order_id: O1_ID,
        order_number: 'STG-20260521-R62J',
        seller_id: AIGARS_SELLER_CP_ID,
        invoice_number: 'INV-2026-00003',
        consumption_ms: 'LV',
        item_value_cents: 2000,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-05-26: VID April VAT refund received (C.8) — clears 2380
  {
    entry_number: '8',
    description: 'VID VAT refund €0.30 — April 2026 PVN refund received in operating account; clears 2380',
    event: {
      event_type: 'vid.refund_received',
      source_doc_type: SOURCE_DOC_TYPE_VID_REFUND,
      source_doc_id: 'may_2026_entry_8',
      posting_date: '2026-05-26',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'VID VAT refund €0.30 — April 2026 PVN deklarācija refund position settled (clears 2380 receivable from close_2026_04)',
      counterparty_id: SYSTEM_COUNTERPARTY.VID,
      payload: tag('8', {
        refund_cents: 30,
        vid_payment_ref: 'VID-refund-2026-04',
        for_period: '2026-04'
      })
    }
  },

  // 2026-05-27: Order 2 cart payment (C.1 card → 2630 clearing)
  {
    entry_number: '9',
    description: 'Order 2 (STG-20260527-RVY5) cart €73.50 — card receipt to 2630 clearing; suspense pending completion',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'may_2026_entry_9',
      posting_date: '2026-05-27',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260527-RVY5 cart €73.50 — card to 2630 EveryPay clearing; suspense pending completion',
      payload: tag('9', {
        payment_method: 'card',
        gross_cart_cents: 7350,
        buyer_wallet_cents: 0,
        order_id: O2_ID,
        cart_payment_id: O2_CART,
        everypay_payment_id: O2_EVERYPAY
      })
    }
  },

  // 2026-05-28: Order 3 cart payment (C.2 bank-link → 2620)
  {
    entry_number: '10',
    description: 'Order 3 (STG-20260528-BCFQ) cart €6.10 — bank-link receipt direct to 2620; suspense pending completion',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'may_2026_entry_10',
      posting_date: '2026-05-28',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260528-BCFQ cart €6.10 — bank-link (PIS) to 2620; suspense pending completion',
      payload: tag('10', {
        payment_method: 'bank_link',
        gross_cart_cents: 610,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: O3_ID,
        cart_payment_id: O3_CART,
        everypay_payment_id: O3_EVERYPAY
      })
    }
  },

  // 2026-05-29: Order 2 EveryPay settlement (C.3 → 2620)
  {
    entry_number: '11',
    description: 'Order 2 EveryPay settlement €73.50 — clearing 2630 → e-commerce account 2620 (POS settled 29.05)',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'may_2026_entry_11',
      posting_date: '2026-05-29',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'EveryPay settlement €73.50 — STG-20260527-RVY5 card payment released from 2630 clearing to 2620',
      payload: tag('11', {
        settlement_cents: 7350,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260529-7350',
        batch_date: '2026-05-29',
        settlement_value_date: '2026-05-29',
        included_txn_refs: [O2_EVERYPAY]
      })
    }
  },

  // 2026-05-29: Order 3 completion (O.1 LV B2C, 21%)
  {
    entry_number: '12',
    description: 'Order 3 completion €6.10 — LV B2C (21%); seller_net €3.60, commission+shipping VAT €0.43 to 5710-LV-OUT',
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'may_2026_entry_12',
      posting_date: '2026-05-29',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260528-BCFQ — LV B2C completion (item €4.00 + ship €2.10 = €6.10; seller_net €3.60; VAT €0.43 to 5710-LV-OUT)',
      counterparty_id: AIGARS_SELLER_CP_ID,
      payload: tag('12', {
        order_id: O3_ID,
        order_number: 'STG-20260528-BCFQ',
        seller_id: AIGARS_SELLER_CP_ID,
        invoice_number: 'INV-2026-00004',
        consumption_ms: 'LV',
        item_value_cents: 400,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-05-30: Order 4 cart payment (C.1 card → 2630 clearing; settles June)
  {
    entry_number: '13',
    description: 'Order 4 (STG-20260530-9EDS) cart €28.34 — card receipt to 2630 clearing (settles 01.06); suspense pending completion',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'may_2026_entry_13',
      posting_date: '2026-05-30',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260530-9EDS cart €28.34 — card to 2630 EveryPay clearing; settlement + completion fall in June',
      payload: tag('13', {
        payment_method: 'card',
        gross_cart_cents: 2834,
        buyer_wallet_cents: 0,
        order_id: O4_ID,
        cart_payment_id: O4_CART,
        everypay_payment_id: O4_EVERYPAY
      })
    }
  },

  // 2026-05-30: Vincit / pats.lv 50% pre-term cancellation refund (I.8)
  {
    entry_number: '14',
    description: 'Vincit/pats.lv refund €35.88 — 50% pre-term cancellation of VO-113703; reverses €29.65 expense + €6.23 input VAT',
    event: {
      event_type: 'vendor.refund_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_REFUND,
      source_doc_id: 'may_2026_entry_14',
      posting_date: '2026-05-30',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Vincit Online SIA refund €35.88 — 50% pre-term cancellation of pats.lv PRO (orig invoice VO-113703 €71.76); reverses 7740 €29.65 + 5710-LV-IN €6.23',
      counterparty_id: VINCIT_CP_ID,
      payload: tag('14', {
        refund_net_cents: 2965,
        refund_vat_cents: 623,
        expense_account: '7740',
        bank_account: '2610',
        original_invoice_ref: 'VO-113703',
        vat_treatment: 'standard'
      })
    }
  },

  // 2026-05-31: Order 5 cart payment (C.2 bank-link → 2620; completes June)
  {
    entry_number: '15',
    description: 'Order 5 (STG-20260531-SXYU) cart €47.70 — bank-link receipt direct to 2620 (LT seller); suspense pending completion',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'may_2026_entry_15',
      posting_date: '2026-05-31',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260531-SXYU cart €47.70 — bank-link (PIS) to 2620; LT seller, O.3 OSS completion falls in June',
      payload: tag('15', {
        payment_method: 'bank_link',
        gross_cart_cents: 4770,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: O5_ID,
        cart_payment_id: O5_CART,
        everypay_payment_id: O5_EVERYPAY
      })
    }
  },

  // 2026-05-31: Order 6 cart payment (C.1 card → 2630 clearing; settles June)
  {
    entry_number: '16',
    description: 'Order 6 (STG-20260531-UF9E) cart €122.10 — card receipt to 2630 clearing (settles 02.06); suspense pending completion',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'may_2026_entry_16',
      posting_date: '2026-05-31',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Order STG-20260531-UF9E cart €122.10 — card to 2630 EveryPay clearing; settlement + completion fall in June',
      payload: tag('16', {
        payment_method: 'card',
        gross_cart_cents: 12210,
        buyer_wallet_cents: 0,
        order_id: O6_ID,
        cart_payment_id: O6_CART,
        everypay_payment_id: O6_EVERYPAY
      })
    }
  },

  // 2026-05-31: Meta ads — EU B2B RC invoice receipt (I.3), 5 May-dated invoices accrued to 5310-META
  {
    entry_number: '17',
    description: 'Meta ads €13.00 — EU B2B RC (5 invoices 27–31 May, code P); self-assess 21% RC VAT €2.73; accrued to 5310-META',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'may_2026_entry_17',
      posting_date: '2026-05-31',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Meta Platforms Ireland ads €13.00 — EU B2B RC (Article 196); 5 invoices FBADS-046-105967339/105971606/105977993/105982609/105987014 (27–31 May); LV self-assessment 21%',
      counterparty_id: META_CP_ID,
      payload: tag('17', {
        invoice_net_cents: 1300,
        invoice_vat_cents: 0,
        expense_account: '7750',
        vat_treatment: 'eu_b2b_rc',
        vendor_invoice_number: 'FBADS-046-105967339+4',
        vendor_vat_number: 'IE9692928F',
        vendor_country: 'IE',
        invoice_date: '2026-05-31'
      })
    }
  },

  // 2026-05-31: Meta ads — payment of the 3 May-settled invoices (I.7), €7.00 from 2610
  {
    entry_number: '18',
    description: 'Meta ads payment €7.00 — 3 invoices settled on card 29–31 May; €6.00 remains payable (settles June)',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'may_2026_entry_18',
      posting_date: '2026-05-31',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'Meta ads payment €7.00 — MasterCard settlements 29.05 (€2) + 30.05 (€2) + 31.05 (€3); remaining €6.00 on 5310-META settles June',
      counterparty_id: META_CP_ID,
      payload: tag('18', {
        payment_cents: 700,
        payable_account: '5310-META',
        vendor_invoice_number: 'FBADS-046-105967339+2',
        bank_account: '2610'
      })
    }
  },

  // 2026-05-31: May P.1 VAT consolidation (payable position €7.22)
  {
    entry_number: 'close_2026_05',
    description: 'May 2026 VAT consolidation — €7.22 payable to VID',
    event: {
      event_type: 'period_close.monthly_vat',
      source_doc_type: 'period_close',
      source_doc_id: 'close_2026_05',
      posting_date: '2026-05-31',
      accounting_period: '2026-05',
      tax_period: '2026-05',
      narrative: 'May 2026 VAT consolidation — clears 5710-LV-OUT €1.11 (orders 1+3) and net 5710-LV-IN −€6.11 (EveryPay €0.12 input − Vincit €6.23 reversal); €7.22 payable to 5710-09. Foreign RC (Anthropic, Meta) stays on balance sheet.',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('close_2026_05', {
        closing_period: '2026-05',
        net_refund_cents: -722,
        net_payable_to_vid_cents: 722,
        lines: [
          {
            account_code: '5710-LV-OUT',
            debit_cents: 111,
            credit_cents: 0,
            narrative: 'Clear LV output VAT — orders 1+3 (May close)'
          },
          {
            account_code: '5710-LV-IN',
            debit_cents: 611,
            credit_cents: 0,
            narrative: 'Clear net LV input VAT — €0.12 EveryPay fee input less €6.23 Vincit reversal (net €6.11 credit)'
          },
          {
            account_code: '5710-09',
            debit_cents: 0,
            credit_cents: 722,
            narrative: 'VAT payable to VID — May 2026 PVN deklarācija'
          }
        ]
      })
    }
  }
];

// ---------------------------------------------------------------------------
// Sanity assertion: 19 emits expected (18 marketplace/vendor + 1 P.1 close).
// Depreciation is NOT here — the monthly-depreciation cron posted it.
// ---------------------------------------------------------------------------
export const TOTAL_BACKFILL_ENTRIES = 19;
if (BACKFILL_ENTRIES.length !== TOTAL_BACKFILL_ENTRIES) {
  throw new Error(
    `may-2026-backfill-data.ts: expected ${TOTAL_BACKFILL_ENTRIES} BACKFILL_ENTRIES, ` +
    `got ${BACKFILL_ENTRIES.length}. Update TOTAL_BACKFILL_ENTRIES + the reconcile checkpoints together.`
  );
}
