/**
 * June 2026 backfill — data table.
 *
 * Reconstructs STG's marketplace + vendor GL activity for June 2026. Stage 3
 * cutover (removing the `is_staff_test` gate at the four wrap call sites) never
 * shipped — production ran the whole month on legacy paths, same as April and
 * May, so June has zero lifecycle-emitted journal_lines. This is the third
 * consecutive manual backfill cycle.
 *
 * Source of truth:
 *   - Swedbank statements: operating account 2610 (LV89…5377 7) closing €99.47;
 *     e-commerce settlement account 2620 (LV24…4950 3) closing €886.35.
 *   - orders table (queried 2026-07-04): 21 orders completed in June (excl.
 *     STG-20260607-G6QC, see below), plus 3 orders paid in June but completing
 *     in July (E93F, XK5D, YEB9) and the June catch-up of 4 May-created orders
 *     (RVY5/Nelle, 9EDS, SXYU/Gedas, UF9E — orders 2/4/5/6 from May's backfill).
 *   - Vendor invoices: Unisend 2601554 (€10.14), Anthropic JQYX1OS2-0012 (€18.00)
 *     + JQYX1OS2-0013 (€84.34), Porkbun 10793486 (USD FX), Hetzner 088001013289
 *     (€13.47, covers Apr+May+June retroactively — first invoice ever received;
 *     booked in full to June per user decision since April/May are hard-locked),
 *     Meta FBADS-046-* (6 invoices, €28.70 total — 2 of the 8 June card charges
 *     were actually May's accrual settling in cash, not new June spend).
 *
 * NOT in this backfill (deferred):
 *   - The June P.1 VAT close: the Swedbank/EveryPay platform-fee invoice for
 *     the 15.06 statement lines (€0.72, VAT-bearing — inconsistent with the
 *     usual exempt-financial-service treatment) isn't available until
 *     ~15 July. June stays `open` until that lands, then P.1 + soft-lock +
 *     PVN filing (due 20 July) all follow in a second pass.
 *   - STG-20260607-G6QC: 100%-wallet-funded order (buyer used existing wallet
 *     balance, no EveryPay involved). The live `cart-wallet-pay` route never
 *     calls the accounting engine — no C.1/C.2 antecedent ever gets posted for
 *     wallet-only carts, live or backfilled. Per user decision, skipped
 *     entirely (matches live "orphan" behavior) rather than hand-constructed;
 *     leaves a small known wallet-integrity gap for this one order until that
 *     route gets real GL wiring (separate follow-up, not in scope here).
 *
 * Engine types used (two new, three extended — all landed on this branch):
 *   - C.11 (NEW): VID VAT payment made — mirrors C.8 (refund); nothing existed
 *     for STG paying a payable down. Closes the May €7.22 PVN payment.
 *   - I.5 / C.4: added `bank_account` override (previously hardcoded 2610),
 *     mirroring the override C.1/C.2/C.3 already had. Needed because per-
 *     transaction card-settlement fees and one seller withdrawal (Ausrius,
 *     €15.30) came out of 2620, not 2610.
 *   - O.1/O.3/O.5 completions (21), C.1/C.2 cart payments (20, incl. 1 hybrid
 *     bank+wallet), C.3 settlements (5, two combining multiple orders' refs),
 *     C.4 withdrawals (3), I.1 (Unisend), I.3+I.7 (Meta), I.4 (Anthropic ×2
 *     EUR path + Porkbun USD FX path).
 *
 * Seller counterparties: unlike April/May (only ever involved Aigars, already
 * seeded), June introduces ~10 new sellers with their first-ever completion.
 * The live wrap lazy-inits seller counterparties via `resolveSellerCounterparty`
 * (lifecycle-wraps.ts) — insert-without-id, DB assigns the UUID. The backfill
 * bypasses the wrap (calls `emit()` directly), so entries needing a seller
 * counterparty carry `sellerUserId` instead of a pre-known `counterparty_id`;
 * the runner (`june-2026-backfill.ts`) resolves-or-creates it immediately
 * before each such emit and mutates the event in place. This is naturally
 * idempotent — a re-run's lookup finds the row the first run created.
 *
 * source_doc_id convention: `june_2026_entry_<N>` for N=1..61. `close_2026_06`
 * (P.1) is NOT in this file — deferred per above.
 */

import './_load-env';

import type { PostingEvent } from '@/lib/accounting/types';

export interface BackfillEntry {
  readonly entry_number: string;
  readonly description: string;
  readonly event: PostingEvent;
  /**
   * When set, the runner resolves-or-creates a seller counterparty for this
   * user_id (mirroring resolveSellerCounterparty's lazy-init) immediately
   * before emit, then overwrites event.counterparty_id and
   * event.payload.seller_id with the resolved id.
   */
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

// ---------------------------------------------------------------------------
// Counterparties — only PORKBUN is new this month. Anthropic, Meta, Swedbank,
// Hetzner, Unisend, VID all already exist (Phase 0 / April / May) and are
// referenced by id only, NOT re-seeded (avoids risking an overwrite of live
// fields). Seller counterparties are NOT listed here — see file header.
// ---------------------------------------------------------------------------

const PORKBUN_CP_ID = 'a6666666-6666-4666-8666-666666666666';

const ANTHROPIC_CP_ID = 'a2222222-2222-4222-8222-222222222222';
const META_CP_ID = 'a3333333-3333-4333-8333-333333333333';
const UNISEND_CP_ID = 'a9999999-9999-4999-8999-999999999999';
const HETZNER_CP_ID = 'a8888888-8888-4888-8888-888888888888';
const VID_CP_ID = '00000000-0000-0000-0000-000000000001';

export const BACKFILL_COUNTERPARTIES: readonly BackfillCounterparty[] = [
  {
    id: PORKBUN_CP_ID,
    type: 'vendor',
    user_id: null,
    full_name: 'Porkbun LLC',
    country: 'US',
    tax_status: null,
    vat_number: null,
    vies_verified_at: null,
    vendor_code: 'PB',
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
const SOURCE_DOC_TYPE_BANK_FEE = 'bank_fee';
const SOURCE_DOC_TYPE_SETTLEMENT = 'everypay_settlement';
const SOURCE_DOC_TYPE_WITHDRAWAL = 'withdrawal_request';
const SOURCE_DOC_TYPE_VID_PAYMENT = 'vid_payment';

// ---------------------------------------------------------------------------
// Order + cart constants (orders table, queried 2026-07-04)
// ---------------------------------------------------------------------------

// Legacy May-created orders completing in June (orders 4 + 6 from May's
// backfill — order 2 (RVY5/Nelle) and order 5 (SXYU/Gedas) also complete in
// June but have no card settlement pending, see below).
const O4_ID = '76d03960-b579-4154-bfbd-b68b2193afca'; // STG-20260530-9EDS
const O4_EVERYPAY = '9e5fe44077bdecf935b622c678b39507e8273c99b3c915d49e27d3076075c79a';
const O6_ID = '80838949-1095-4a77-bf03-3f89519bbd0d'; // STG-20260531-UF9E
const O6_EVERYPAY = 'f0e67c279803225407b603ff19e3d70619234e5ee4c03492490cfb6576e0ac72';
const RVY5_ID = '51e04bad-867a-4651-8a18-14269f693bef'; // STG-20260527-RVY5 (Nelle/EE)
const SXYU_ID = '8bf5f297-046e-4aec-b063-730e44b01ebf'; // STG-20260531-SXYU (Gedas/LT)

// June-created orders completing in June
const LXR5_ID = '4a4ceca0-1097-47f3-b5a5-b745c6f0cc02';
const LXR5_CART = 'c9423516-858a-4bdd-a6a9-8bfd56ddccf2';
const LXR5_EVERYPAY = '9ec2598de4bef0bb7a25e95e323a26d3528385bbdb79b4b65ba7b68461bc54a5';

const N669_ID = 'e93dcefc-908c-41cb-9b88-5bda336f3985'; // STG-20260607-669N
const N669_CART = '75660e74-874b-478e-9c16-adbefefbab0b';
const N669_EVERYPAY = 'bda87a4da7c4f9ca8296fd0a4774a259ec7392e8398838685f98084350875c37';

const KH6R_ID = 'a6bae07f-5ed1-4a77-92d0-788bb365a892';
const KH6R_CART = '897dba11-de5b-4527-946f-5348bd77b700';
const KH6R_EVERYPAY = 'ec626695d76d7064f48a8cc96ec4119e0f5998dde1e2f6d162666ce53e2bb70e';

const ENUV_ID = '6dfa347d-b73d-4fe9-b1cb-a32ed6a0a90e';
const ENUV_CART = 'dbd2238b-e4ed-4745-b7e4-35099397633e';
const ENUV_EVERYPAY = '8d2567f58af92a6d023cd45ee863f50a0602b0ba41e044b92ade636f5fa2f9f1';

const UJRJ_ID = '1c50d466-991d-45d4-a881-e7fc61b6fc8c';
const UJRJ_CART = '5706f4d3-29af-4a4b-950a-e6c42dace53d';
const UJRJ_EVERYPAY = 'b7a371edeb3c19f3f835812820a005f44613203396cffdc0c97e350ab0864044';

const DEJJ_ID = 'e9d3f69e-8ae2-4127-b462-f5b6d55ea980';
const DEJJ_CART = '7566a76d-ac6e-4919-af70-e2b674890349';
const DEJJ_EVERYPAY = '0d1b6d57df57b4a4277eaf36ab5f474f6a00318f460393be090ac4bf860278ce';

const KFFH_ID = '5fd0a140-9b4b-4c5c-a8c5-9c3879a5f4cd';
const KFFH_CART = 'e4da5c7c-1607-43d3-b5b0-9c5182da166d';
const KFFH_EVERYPAY = '128b85359b438770a5021151517aec587a843cdaabc622c5ddb5c92e970cd816';

const NKZF_ID = '3512dbd3-0e50-4277-af41-158692d66d3b';
const NKZF_CART = '53a6b00b-a4c5-41a7-885f-6c0b96736d53';
const NKZF_EVERYPAY = '2014e71a5e567eceea3d050a2a5ba52d571be587618105e895903ebfd3b5a419';

const KUTW_ID = '3feeda0b-8732-437c-9ba8-879fb1e1fd78';
const KUTW_CART = 'd6a7e303-cb0f-4723-8a98-94ff5955b838';
const KUTW_EVERYPAY = '462d9a1c0802582a77f68cbcfe060bd14dfa6fce657acff2fd3a7f3a0327f32a';

const DM53_ID = 'e271561a-d2d3-4a62-8b9a-0b0019214145';
const DM53_CART = '4a71c23a-9657-444e-8ae6-77be60b89f0c';
const DM53_EVERYPAY = '032b9419da6e928983ce53a5c21c91162af4b82dc09b817679832c050c2ef598';

const NNV9_ID = '7286677c-ce52-4114-9709-8464f7b1f494';
const NNV9_CART = '58565661-aed8-4274-9daf-344af30abe61';
const NNV9_EVERYPAY = '960c524ede401128de82f5df3bc091e80712ad976765d4aadd4175d7817ab477';

const CHMP_ID = '95b89373-8d6e-4fc5-817a-5dc69fd989ba';
const CHMP_CART = '187ae04e-e553-4a17-bd92-15ae2f801924';
const CHMP_EVERYPAY = 'c1faca3137f97543b46d6d930b24436bebad6a25b36b5bce0c22f3fbbf451bba';

const VA8M_ID = '76b2f150-5701-4f57-9e18-d82d1aeaaae8';
const VA8M_CART = 'c9e9d021-279b-48ec-85ad-1a622069c857';
const VA8M_EVERYPAY = '29ff4f4d6d30b41ea4fa974496a4185b5180aa780c681fff099ccccb5636ffc1';

const YKKT_ID = '8c0b0d3e-7da6-40ff-b543-a8da66b7a68c';
const YKKT_CART = 'a47dc78b-f616-412e-ac73-c6a728b8301c';
const YKKT_EVERYPAY = 'fd7833ba7ee09222457e4517680a8181263dea7a1969904ae5e0f5b9a69a5352';

const YAHY_ID = 'c857d334-ff59-4cf4-8415-f72953d87128';
const YAHY_CART = 'bf87ade3-d627-4c21-ad5a-4395fd2905ff';
const YAHY_EVERYPAY = '60b69c0b4aaa05cc9a1d1319823638a391508e06687b495a37c025eae6789e00';

const NZ6S_ID = '970b5417-d001-4788-9cfa-6d5832556b78'; // STG-20260622-9Z6S
const NZ6S_CART = '8903d365-fd65-4ad4-9cce-7b0d0ef695e9';
const NZ6S_EVERYPAY = 'c0cc22d071d9db2dd256798b6dad009dbff2817e644e88b2d807b73237aa91e9';

const VPM7_ID = '9b68a364-437c-4b75-bd24-28c317fe7c74';
const VPM7_CART = '2c696eaf-a08d-491e-8c32-680e13ff7c05';
const VPM7_EVERYPAY = '1f65cd04e7564966b84c12582caaf73ee089d63e647aae00b50378da3d496587';

// Cart-payment-only in June — completion deferred to July's backfill
const E93F_ID = '2147e415-837b-4480-8935-8c07095ea3e1';
const E93F_CART = '5e797c56-4a78-47c9-a6ab-33a9051291b8';
const E93F_EVERYPAY = '1bdbbcc67267eafdde02a20b35d6d3fce41574ed79f5cb08a60a00dd9cc8ab4b';
const E93F_BUYER_ID = '880caa98-9098-4364-bd86-5bde6410992e'; // buyer wallet contribution

const XK5D_CART = 'd1ecf79e-b540-404d-8500-8c9d8a1605b9';
const XK5D_EVERYPAY = '44cd958244da96472932793c233410a435ba01500ee4e10f94567e295a4b55cd';
const XK5D_ID = '5ee961af-ad8c-4080-b64e-5ae160ed9ff4';

const YEB9_CART = '4b6c9ef1-3295-42f0-a99e-9fc9ba9b0052';
const YEB9_EVERYPAY = '77dbe714063e9df07d2831885f6751e543c1f26b314567980758c5cebe87c31d';
const YEB9_ID = '6797e321-e92a-4f4d-ae8a-0ff7c8086412';

// STG-20260607-G6QC — 100%-wallet-funded (buyer used existing wallet balance,
// no EveryPay involved). Originally skipped entirely (matching the live
// cart-wallet-pay route, which never touches the accounting engine — see
// file header). Now that route is fixed (this same PR), correcting the gap
// here so June's wallet integrity ties out too: entries 66/67 below.
const G6QC_ID = 'faaf6c45-624e-4eda-96fb-14a656cec291';
const G6QC_CART = 'e4c01dc0-5e1b-4394-a862-b34ea6de2a63';

// Seller user_ids (new sellers this month; see file header for the resolution
// mechanism). Aigars (630f6e7f-95cb-41fa-a98f-a4d199aa32fe) already has a
// counterparty from Phase 0 — referenced via sellerUserId too so the runner's
// single resolution path covers every seller uniformly (existing lookup finds
// his row, doesn't create a new one).
const AIGARS_USER_ID = '630f6e7f-95cb-41fa-a98f-a4d199aa32fe';
const NELLE_USER_ID = 'db9a7be7-f5a3-4e24-9c6e-b036ab6aca2c';
const GEDAS_USER_ID = '244f077c-0255-4bac-bef6-94c7b6e363cf';
const AUSRIUS_USER_ID = '92997149-2f02-4888-928d-3b6d350eeebb';
const SILVOS_USER_ID = 'd508c35a-0a91-4a3d-b645-c6ab204893a8';
const MYFFU_USER_ID = '49d25144-094f-4f1e-8411-a6553af098b8';
const DAINIS_USER_ID = '880caa98-9098-4364-bd86-5bde6410992e';
const LUMINARIOUS_USER_ID = 'ee3b9fe6-c074-411a-91bb-c3d1f9319298';
const ARTURS_P_USER_ID = 'f4d4492d-d3b4-4c59-8ca6-d1bff83a3d75';
const BEERZINJSH_USER_ID = '159fad8d-59e3-4014-8040-2187718148fb';
const KASPARS_SILAVS_USER_ID = 'd8f7acef-acb1-44e6-a525-4e58817f679d';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tag(entry_number: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    june_2026_entry_number: entry_number,
    ...extras
  };
}

// ---------------------------------------------------------------------------
// BACKFILL_ENTRIES — 61 emits in posting-date order
// ---------------------------------------------------------------------------

export const BACKFILL_ENTRIES: readonly BackfillEntry[] = [
  // 2026-06-01: LXR5 cart payment (C.1 card → 2630)
  {
    entry_number: '1',
    description: 'LXR5 cart €23.85 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_1',
      posting_date: '2026-06-01',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260601-LXR5 cart €23.85 — card to 2630 EveryPay clearing',
      payload: tag('1', {
        payment_method: 'card',
        gross_cart_cents: 2385,
        buyer_wallet_cents: 0,
        order_id: LXR5_ID,
        cart_payment_id: LXR5_CART,
        everypay_payment_id: LXR5_EVERYPAY
      })
    }
  },

  // 2026-06-01: Legacy Order 4 (9EDS) EveryPay settlement (C.3 → 2620)
  {
    entry_number: '2',
    description: 'Order 4 (9EDS) EveryPay settlement €28.34 — clearing 2630 → 2620 (batch 31.05, in-transit from May)',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_2',
      posting_date: '2026-06-01',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €28.34 — STG-20260530-9EDS card payment released from 2630 to 2620 (May in-transit)',
      payload: tag('2', {
        settlement_cents: 2834,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260601-2834',
        batch_date: '2026-05-31',
        settlement_value_date: '2026-06-01',
        included_txn_refs: [O4_EVERYPAY]
      })
    }
  },

  // 2026-06-02: Legacy Order 6 (UF9E) EveryPay settlement (C.3 → 2620)
  {
    entry_number: '3',
    description: 'Order 6 (UF9E) EveryPay settlement €122.10 — clearing 2630 → 2620 (batch 01.06, in-transit from May)',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_3',
      posting_date: '2026-06-02',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €122.10 — STG-20260531-UF9E card payment released from 2630 to 2620 (May in-transit)',
      payload: tag('3', {
        settlement_cents: 12210,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260602-12210',
        batch_date: '2026-06-01',
        settlement_value_date: '2026-06-02',
        included_txn_refs: [O6_EVERYPAY]
      })
    }
  },

  // 2026-06-03: RVY5 completion (O.5 EE B2C OSS) — Nelle
  {
    entry_number: '4',
    description: 'RVY5 completion €73.50 — EE B2C OSS; June catch-up of May order 2',
    sellerUserId: NELLE_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_4',
      posting_date: '2026-06-03',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260527-RVY5 — EE B2C OSS completion (item €70.00 + ship €3.50 = €73.50); June catch-up of a May-created order',
      payload: tag('4', {
        order_id: RVY5_ID,
        order_number: 'STG-20260527-RVY5',
        invoice_number: 'INV-2026-00006',
        consumption_ms: 'EE',
        item_value_cents: 7000,
        shipping_value_cents: 350
      })
    }
  },

  // 2026-06-03: Nelle withdrawal (C.4, default 2610)
  {
    entry_number: '5',
    description: 'Nelle withdrawal €63.00 — WD-2026-00002, Swedbank operating (2610)',
    sellerUserId: NELLE_USER_ID,
    event: {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: SOURCE_DOC_TYPE_WITHDRAWAL,
      source_doc_id: 'june_2026_entry_5',
      posting_date: '2026-06-03',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Seller withdrawal €63.00 — WD-2026-00002 (Nelle Kivilaid, EE812200221020643006)',
      payload: tag('5', {
        withdrawal_cents: 6300,
        seller_id: '', // resolved by runner
        withdrawal_ref: 'WD-2026-00002',
        seller_iban: 'EE812200221020643006'
      })
    }
  },

  // 2026-06-03: LXR5 EveryPay settlement (C.3 → 2620, batch 02.06, no fee shown)
  {
    entry_number: '6',
    description: 'LXR5 EveryPay settlement €23.85 — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_6',
      posting_date: '2026-06-03',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €23.85 — STG-20260601-LXR5 card payment released from 2630 to 2620',
      payload: tag('6', {
        settlement_cents: 2385,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260603-2385',
        batch_date: '2026-06-02',
        settlement_value_date: '2026-06-03',
        included_txn_refs: [LXR5_EVERYPAY]
      })
    }
  },

  // 2026-06-02: LXR5 completion (O.1 LV) — Aigars
  {
    entry_number: '6b',
    description: 'LXR5 completion €23.85 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_6b',
      posting_date: '2026-06-02',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260601-LXR5 — LV B2C completion (item €21.95 + ship €1.90 = €23.85)',
      payload: tag('6b', {
        order_id: LXR5_ID,
        order_number: 'STG-20260601-LXR5',
        invoice_number: 'INV-2026-00005',
        consumption_ms: 'LV',
        item_value_cents: 2195,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-06-04: 9EDS completion (O.1 LV) — Aigars; June catch-up of May order 4
  {
    entry_number: '7',
    description: '9EDS completion €28.34 — LV B2C; June catch-up of May order 4',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_7',
      posting_date: '2026-06-04',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260530-9EDS — LV B2C completion (item €26.24 + ship €2.10 = €28.34); June catch-up of a May-created order',
      payload: tag('7', {
        order_id: O4_ID,
        order_number: 'STG-20260530-9EDS',
        invoice_number: 'INV-2026-00007',
        consumption_ms: 'LV',
        item_value_cents: 2624,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-04: Meta ads payment (I.7) — clears the May-rollover €6.00 payable
  // (2 of May's 5 accrued invoices — UCCSZNMT32 + 4CHMGNZS32 — actually card-
  // settled 01.06 + 04.06, not within May itself; May's own entry 18 already
  // flagged this exact €6.00 as "remains payable (settles June)"). Distinct
  // from June's own €28.70 accrual + payment (entries 59/60 below).
  {
    entry_number: '7b',
    description: 'Meta ads payment €6.00 — clears May-rollover payable (2 invoices card-settled 01.06 + 04.06)',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'june_2026_entry_7b',
      posting_date: '2026-06-04',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Meta ads payment €6.00 — MasterCard settlements 01.06 (UCCSZNMT32 €3.00) + 04.06 (4CHMGNZS32 €3.00) clear the May-accrued rollover payable in full',
      counterparty_id: META_CP_ID,
      payload: tag('7b', {
        payment_cents: 600,
        payable_account: '5310-META',
        vendor_invoice_number: 'FBADS-046-105982609+105987014',
        bank_account: '2610'
      })
    }
  },

  // 2026-06-05: SXYU completion (O.3 LT B2C OSS) — Gedas; June catch-up of May order 5
  {
    entry_number: '8',
    description: 'SXYU completion €47.70 — LT B2C OSS; June catch-up of May order 5',
    sellerUserId: GEDAS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_8',
      posting_date: '2026-06-05',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260531-SXYU — LT B2C OSS completion (item €45.00 + ship €2.70 = €47.70); June catch-up of a May-created order',
      payload: tag('8', {
        order_id: SXYU_ID,
        order_number: 'STG-20260531-SXYU',
        invoice_number: 'INV-2026-00008',
        consumption_ms: 'LT',
        item_value_cents: 4500,
        shipping_value_cents: 270
      })
    }
  },

  // 2026-06-05: Unisend invoice 2601554 (I.1 LV standard VAT), same-day pay 2610
  {
    entry_number: '9',
    description: 'Unisend invoice 2601554 €10.14 (€8.38 net + €1.76 VAT) — same-day pay 2610',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'june_2026_entry_9',
      posting_date: '2026-06-05',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Unisend invoice 2601554 €10.14 (dated 31.05, recognized at receipt) — 3 parcel-locker shipments (LV-LV, LV-LT); paid same-day from 2610',
      counterparty_id: UNISEND_CP_ID,
      payload: tag('9', {
        invoice_net_cents: 838,
        invoice_vat_cents: 176,
        expense_account: '7720',
        payable_account: '2610',
        vat_treatment: 'standard',
        vendor_invoice_number: '2601554',
        vendor_vat_number: 'LV40203523445',
        invoice_date: '2026-05-31'
      })
    }
  },

  // 2026-06-06: UF9E completion (O.1 LV) — Aigars; June catch-up of May order 6
  {
    entry_number: '10',
    description: 'UF9E completion €122.10 — LV B2C; June catch-up of May order 6',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_10',
      posting_date: '2026-06-06',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260531-UF9E — LV B2C completion (item €120.00 + ship €2.10 = €122.10); June catch-up of a May-created order',
      payload: tag('10', {
        order_id: O6_ID,
        order_number: 'STG-20260531-UF9E',
        invoice_number: 'INV-2026-00009',
        consumption_ms: 'LV',
        item_value_cents: 12000,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-06: Gediminas withdrawal (C.4, default 2610)
  {
    entry_number: '11',
    description: 'Gediminas withdrawal €40.50 — WD-2026-00003, Swedbank operating (2610)',
    sellerUserId: GEDAS_USER_ID,
    event: {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: SOURCE_DOC_TYPE_WITHDRAWAL,
      source_doc_id: 'june_2026_entry_11',
      posting_date: '2026-06-06',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Seller withdrawal €40.50 — WD-2026-00003 (Gediminas Jonaitis, LT127044090110125678)',
      payload: tag('11', {
        withdrawal_cents: 4050,
        seller_id: '',
        withdrawal_ref: 'WD-2026-00003',
        seller_iban: 'LT127044090110125678'
      })
    }
  },

  // 2026-06-06: UJRJ cart payment (C.1 card → 2630)
  {
    entry_number: '12',
    description: 'UJRJ cart €34.10 — card receipt to 2630 clearing (still in-transit at 30.06 — no June settlement)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_12',
      posting_date: '2026-06-06',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260606-UJRJ cart €34.10 — card to 2630 EveryPay clearing; settlement not found in June statement, carries in-transit to July',
      payload: tag('12', {
        payment_method: 'card',
        gross_cart_cents: 3410,
        buyer_wallet_cents: 0,
        order_id: UJRJ_ID,
        cart_payment_id: UJRJ_CART,
        everypay_payment_id: UJRJ_EVERYPAY
      })
    }
  },

  // 2026-06-07: 669N cart payment (C.2 bank-link → 2620)
  {
    entry_number: '13',
    description: '669N cart €28.90 — bank-link receipt direct to 2620 (Mētra Drulle)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_13',
      posting_date: '2026-06-07',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260607-669N cart €28.90 — bank-link (PIS) to 2620',
      payload: tag('13', {
        payment_method: 'bank_link',
        gross_cart_cents: 2890,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: N669_ID,
        cart_payment_id: N669_CART,
        everypay_payment_id: N669_EVERYPAY
      })
    }
  },

  // 2026-06-07: ENUV cart payment (C.2 bank-link → 2620)
  {
    entry_number: '14',
    description: 'ENUV cart €27.10 — bank-link receipt direct to 2620 (Triinu Viikholm)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_14',
      posting_date: '2026-06-07',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260607-ENUV cart €27.10 — bank-link (PIS) to 2620',
      payload: tag('14', {
        payment_method: 'bank_link',
        gross_cart_cents: 2710,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: ENUV_ID,
        cart_payment_id: ENUV_CART,
        everypay_payment_id: ENUV_EVERYPAY
      })
    }
  },

  // 2026-06-07: Anthropic invoice JQYX1OS2-0012 (I.4 EUR path), same-day pay 2610
  {
    entry_number: '15',
    description: 'Anthropic €18.00 — non-EU RC, EUR-billed (Claude Pro); same-day pay 2610',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'june_2026_entry_15',
      posting_date: '2026-06-07',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Anthropic invoice JQYX1OS2-0012 €18.00 — non-EU RC (Article 44 + 196); EUR-billed, no FX; LV self-assessment 21%',
      counterparty_id: ANTHROPIC_CP_ID,
      payload: tag('15', {
        invoice_currency: 'EUR',
        invoice_net_cents: 1800,
        expense_account: '7730',
        payable_account: '2610',
        vat_treatment: 'non_eu_rc',
        vendor_invoice_number: 'JQYX1OS2-0012',
        vendor_country: 'US',
        invoice_date: '2026-06-05'
      })
    }
  },

  // 2026-06-08: KH6R cart payment (C.1 card → 2630)
  {
    entry_number: '16',
    description: 'KH6R cart €11.90 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_16',
      posting_date: '2026-06-08',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260608-KH6R cart €11.90 — card to 2630 EveryPay clearing',
      payload: tag('16', {
        payment_method: 'card',
        gross_cart_cents: 1190,
        buyer_wallet_cents: 0,
        order_id: KH6R_ID,
        cart_payment_id: KH6R_CART,
        everypay_payment_id: KH6R_EVERYPAY
      })
    }
  },

  // 2026-06-08: KFFH cart payment (C.1 card → 2630)
  {
    entry_number: '17',
    description: 'KFFH cart €19.50 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_17',
      posting_date: '2026-06-08',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260608-KFFH cart €19.50 — card to 2630 EveryPay clearing',
      payload: tag('17', {
        payment_method: 'card',
        gross_cart_cents: 1950,
        buyer_wallet_cents: 0,
        order_id: KFFH_ID,
        cart_payment_id: KFFH_CART,
        everypay_payment_id: KFFH_EVERYPAY
      })
    }
  },

  // 2026-06-08: Swedbank e-commerce platform commission (May fee, billed June) — I.5, exempt, 2610
  {
    entry_number: '18',
    description: 'Swedbank e-commerce commission €0.90 — VAT-exempt financial service (May fee billed in June)',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'june_2026_entry_18',
      posting_date: '2026-06-08',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Swedbank AS e-commerce platform commission €0.90 (EPLV_SECONDTURN 05.2026) — PVN likums Article 52 exempt',
      payload: tag('18', {
        fee_cents: 90,
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-06-09: 669N completion (O.1 LV) — Aigars
  {
    entry_number: '19',
    description: '669N completion €28.90 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_19',
      posting_date: '2026-06-09',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260607-669N — LV B2C completion (item €27.00 + ship €1.90 = €28.90)',
      payload: tag('19', {
        order_id: N669_ID,
        order_number: 'STG-20260607-669N',
        invoice_number: 'INV-2026-00010',
        consumption_ms: 'LV',
        item_value_cents: 2700,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-06-09: NKZF cart payment (C.1 card → 2630)
  {
    entry_number: '20',
    description: 'NKZF cart €18.50 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_20',
      posting_date: '2026-06-09',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260609-NKZF cart €18.50 — card to 2630 EveryPay clearing',
      payload: tag('20', {
        payment_method: 'card',
        gross_cart_cents: 1850,
        buyer_wallet_cents: 0,
        order_id: NKZF_ID,
        cart_payment_id: NKZF_CART,
        everypay_payment_id: NKZF_EVERYPAY
      })
    }
  },

  // 2026-06-10: KH6R + KFFH combined EveryPay settlement (C.3 → 2620, batch 09.06)
  {
    entry_number: '21',
    description: 'KH6R + KFFH combined EveryPay settlement €31.40 — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_21',
      posting_date: '2026-06-10',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €31.40 — STG-20260608-KH6R + STG-20260608-KFFH combined batch released from 2630 to 2620',
      payload: tag('21', {
        settlement_cents: 3140,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260610-3140',
        batch_date: '2026-06-09',
        settlement_value_date: '2026-06-10',
        included_txn_refs: [KH6R_EVERYPAY, KFFH_EVERYPAY]
      })
    }
  },

  // 2026-06-10: KH6R + KFFH settlement fee (I.5, 2620 override)
  {
    entry_number: '22',
    description: 'Card settlement fee €0.59 — KH6R + KFFH batch, VAT-exempt, debited from 2620',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'june_2026_entry_22',
      posting_date: '2026-06-10',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Card settlement (MDR) fee €0.59 — KH6R + KFFH batch 09.06, VAT-exempt, debited from 2620',
      payload: tag('22', {
        fee_cents: 59,
        bank_account: '2620',
        vendor: 'everypay',
        fee_type: 'pos_terminal',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-06-10: KH6R completion (O.1 LV) — Aigars
  {
    entry_number: '23',
    description: 'KH6R completion €11.90 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_23',
      posting_date: '2026-06-10',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260608-KH6R — LV B2C completion (item €10.00 + ship €1.90 = €11.90)',
      payload: tag('23', {
        order_id: KH6R_ID,
        order_number: 'STG-20260608-KH6R',
        invoice_number: 'INV-2026-00011',
        consumption_ms: 'LV',
        item_value_cents: 1000,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-06-10: ENUV completion (O.1 LV) — Aigars
  {
    entry_number: '24',
    description: 'ENUV completion €27.10 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_24',
      posting_date: '2026-06-10',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260607-ENUV — LV B2C completion (item €25.00 + ship €2.10 = €27.10)',
      payload: tag('24', {
        order_id: ENUV_ID,
        order_number: 'STG-20260607-ENUV',
        invoice_number: 'INV-2026-00020',
        consumption_ms: 'LV',
        item_value_cents: 2500,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-10: DEJJ cart payment (C.2 bank-link → 2620)
  {
    entry_number: '25',
    description: 'DEJJ cart €77.10 — bank-link receipt direct to 2620 (Karl Erik Saks)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_25',
      posting_date: '2026-06-10',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260610-DEJJ cart €77.10 — bank-link (PIS) to 2620',
      payload: tag('25', {
        payment_method: 'bank_link',
        gross_cart_cents: 7710,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: DEJJ_ID,
        cart_payment_id: DEJJ_CART,
        everypay_payment_id: DEJJ_EVERYPAY
      })
    }
  },

  // 2026-06-11: NKZF EveryPay settlement (C.3 → 2620, batch 10.06)
  {
    entry_number: '26',
    description: 'NKZF EveryPay settlement €18.50 — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_26',
      posting_date: '2026-06-11',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €18.50 — STG-20260609-NKZF card payment released from 2630 to 2620',
      payload: tag('26', {
        settlement_cents: 1850,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260611-1850',
        batch_date: '2026-06-10',
        settlement_value_date: '2026-06-11',
        included_txn_refs: [NKZF_EVERYPAY]
      })
    }
  },

  // 2026-06-11: NKZF settlement fee (I.5, 2620 override)
  {
    entry_number: '27',
    description: 'Card settlement fee €0.22 — NKZF, VAT-exempt, debited from 2620',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'june_2026_entry_27',
      posting_date: '2026-06-11',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Card settlement (MDR) fee €0.22 — NKZF batch 10.06, VAT-exempt, debited from 2620',
      payload: tag('27', {
        fee_cents: 22,
        bank_account: '2620',
        vendor: 'everypay',
        fee_type: 'pos_terminal',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-06-11: UJRJ completion (O.1 LV) — Aigars (no June C.3 antecedent required; suspense already credited by C.1)
  {
    entry_number: '28',
    description: 'UJRJ completion €34.10 — LV B2C (card still in-transit in 2630 at period end)',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_28',
      posting_date: '2026-06-11',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260606-UJRJ — LV B2C completion (item €32.00 + ship €2.10 = €34.10)',
      payload: tag('28', {
        order_id: UJRJ_ID,
        order_number: 'STG-20260606-UJRJ',
        invoice_number: 'INV-2026-00012',
        consumption_ms: 'LV',
        item_value_cents: 3200,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-11: KUTW cart payment (C.2 bank-link → 2620)
  {
    entry_number: '29',
    description: 'KUTW cart €28.50 — bank-link receipt direct to 2620 (Jonaitis Gediminas)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_29',
      posting_date: '2026-06-11',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260611-KUTW cart €28.50 — bank-link (PIS) to 2620',
      payload: tag('29', {
        payment_method: 'bank_link',
        gross_cart_cents: 2850,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: KUTW_ID,
        cart_payment_id: KUTW_CART,
        everypay_payment_id: KUTW_EVERYPAY
      })
    }
  },

  // 2026-06-12: DEJJ completion (O.1 LV) — Aigars
  {
    entry_number: '30',
    description: 'DEJJ completion €77.10 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_30',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260610-DEJJ — LV B2C completion (item €75.00 + ship €2.10 = €77.10)',
      payload: tag('30', {
        order_id: DEJJ_ID,
        order_number: 'STG-20260610-DEJJ',
        invoice_number: 'INV-2026-00013',
        consumption_ms: 'LV',
        item_value_cents: 7500,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-12: KFFH completion (O.3 LT B2C OSS) — Ausrius
  {
    entry_number: '31',
    description: 'KFFH completion €19.50 — LT B2C OSS',
    sellerUserId: AUSRIUS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_31',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260608-KFFH — LT B2C OSS completion (item €17.00 + ship €2.50 = €19.50)',
      payload: tag('31', {
        order_id: KFFH_ID,
        order_number: 'STG-20260608-KFFH',
        invoice_number: 'INV-2026-00014',
        consumption_ms: 'LT',
        item_value_cents: 1700,
        shipping_value_cents: 250
      })
    }
  },

  // 2026-06-12: NKZF completion (O.5 EE B2C OSS) — Silvos
  {
    entry_number: '32',
    description: 'NKZF completion €18.50 — EE B2C OSS',
    sellerUserId: SILVOS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_32',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260609-NKZF — EE B2C OSS completion (item €15.00 + ship €3.50 = €18.50)',
      payload: tag('32', {
        order_id: NKZF_ID,
        order_number: 'STG-20260609-NKZF',
        invoice_number: 'INV-2026-00015',
        consumption_ms: 'EE',
        item_value_cents: 1500,
        shipping_value_cents: 350
      })
    }
  },

  // 2026-06-12: Ausrius withdrawal (C.4, 2620 override — statement shows this one on 2620, not 2610)
  {
    entry_number: '33',
    description: 'Ausrius withdrawal €15.30 — WD-2026-00004, e-commerce settlement (2620)',
    sellerUserId: AUSRIUS_USER_ID,
    event: {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: SOURCE_DOC_TYPE_WITHDRAWAL,
      source_doc_id: 'june_2026_entry_33',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Seller withdrawal €15.30 — WD-2026-00004 (Aušrius Ramanauskas, LT107044060008248701); debited from 2620 per statement',
      payload: tag('33', {
        withdrawal_cents: 1530,
        bank_account: '2620',
        seller_id: '',
        withdrawal_ref: 'WD-2026-00004',
        seller_iban: 'LT107044060008248701'
      })
    }
  },

  // 2026-06-12: CHMP cart payment (C.1 card → 2630)
  {
    entry_number: '34',
    description: 'CHMP cart €22.10 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_34',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260612-CHMP cart €22.10 — card to 2630 EveryPay clearing',
      payload: tag('34', {
        payment_method: 'card',
        gross_cart_cents: 2210,
        buyer_wallet_cents: 0,
        order_id: CHMP_ID,
        cart_payment_id: CHMP_CART,
        everypay_payment_id: CHMP_EVERYPAY
      })
    }
  },

  // 2026-06-13: KUTW completion (O.5 EE B2C OSS) — Myffu
  {
    entry_number: '35',
    description: 'KUTW completion €28.50 — EE B2C OSS',
    sellerUserId: MYFFU_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_35',
      posting_date: '2026-06-13',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260611-KUTW — EE B2C OSS completion (item €25.00 + ship €3.50 = €28.50)',
      payload: tag('35', {
        order_id: KUTW_ID,
        order_number: 'STG-20260611-KUTW',
        invoice_number: 'INV-2026-00017',
        consumption_ms: 'EE',
        item_value_cents: 2500,
        shipping_value_cents: 350
      })
    }
  },

  // 2026-06-13: VA8M cart payment (C.2 bank-link → 2620)
  {
    entry_number: '36',
    description: 'VA8M cart €85.85 — bank-link receipt direct to 2620 (Mihhail Jefimov)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_36',
      posting_date: '2026-06-13',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260613-VA8M cart €85.85 — bank-link (PIS) to 2620',
      payload: tag('36', {
        payment_method: 'bank_link',
        gross_cart_cents: 8585,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: VA8M_ID,
        cart_payment_id: VA8M_CART,
        everypay_payment_id: VA8M_EVERYPAY
      })
    }
  },

  // 2026-06-14: CHMP EveryPay settlement (C.3 → 2620, batch 13.06)
  {
    entry_number: '37',
    description: 'CHMP EveryPay settlement €22.10 — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_37',
      posting_date: '2026-06-14',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €22.10 — STG-20260612-CHMP card payment released from 2630 to 2620',
      payload: tag('37', {
        settlement_cents: 2210,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260614-2210',
        batch_date: '2026-06-13',
        settlement_value_date: '2026-06-14',
        included_txn_refs: [CHMP_EVERYPAY]
      })
    }
  },

  // 2026-06-14: CHMP settlement fee (I.5, 2620 override)
  {
    entry_number: '38',
    description: 'Card settlement fee €0.27 — CHMP, VAT-exempt, debited from 2620',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'june_2026_entry_38',
      posting_date: '2026-06-14',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Card settlement (MDR) fee €0.27 — CHMP batch 13.06, VAT-exempt, debited from 2620',
      payload: tag('38', {
        fee_cents: 27,
        bank_account: '2620',
        vendor: 'everypay',
        fee_type: 'pos_terminal',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-06-14: DM53 cart payment (C.2 bank-link → 2620)
  {
    entry_number: '39',
    description: 'DM53 cart €27.10 — bank-link receipt direct to 2620 (Aivar Kruup)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_39',
      posting_date: '2026-06-14',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260614-DM53 cart €27.10 — bank-link (PIS) to 2620',
      payload: tag('39', {
        payment_method: 'bank_link',
        gross_cart_cents: 2710,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: DM53_ID,
        cart_payment_id: DM53_CART,
        everypay_payment_id: DM53_EVERYPAY
      })
    }
  },

  // 2026-06-15: NNV9 cart payment (C.1 card → 2630)
  {
    entry_number: '40',
    description: 'NNV9 cart €52.70 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_40',
      posting_date: '2026-06-15',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260615-NNV9 cart €52.70 — card to 2630 EveryPay clearing',
      payload: tag('40', {
        payment_method: 'card',
        gross_cart_cents: 5270,
        buyer_wallet_cents: 0,
        order_id: NNV9_ID,
        cart_payment_id: NNV9_CART,
        everypay_payment_id: NNV9_EVERYPAY
      })
    }
  },

  // 2026-06-15: YKKT cart payment (C.1 card → 2630)
  {
    entry_number: '41',
    description: 'YKKT cart €25.20 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_41',
      posting_date: '2026-06-15',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260615-YKKT cart €25.20 — card to 2630 EveryPay clearing',
      payload: tag('41', {
        payment_method: 'card',
        gross_cart_cents: 2520,
        buyer_wallet_cents: 0,
        order_id: YKKT_ID,
        cart_payment_id: YKKT_CART,
        everypay_payment_id: YKKT_EVERYPAY
      })
    }
  },

  // 2026-06-17: NNV9 + YKKT combined EveryPay settlement (C.3 → 2620, batch 16.06)
  {
    entry_number: '42',
    description: 'NNV9 + YKKT combined EveryPay settlement €77.90 — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'june_2026_entry_42',
      posting_date: '2026-06-17',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'EveryPay settlement €77.90 — STG-20260615-NNV9 + STG-20260615-YKKT combined batch released from 2630 to 2620',
      payload: tag('42', {
        settlement_cents: 7790,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260617-7790',
        batch_date: '2026-06-16',
        settlement_value_date: '2026-06-17',
        included_txn_refs: [NNV9_EVERYPAY, YKKT_EVERYPAY]
      })
    }
  },

  // 2026-06-17: NNV9 + YKKT settlement fee (I.5, 2620 override)
  {
    entry_number: '43',
    description: 'Card settlement fee €1.21 — NNV9 + YKKT batch, VAT-exempt, debited from 2620',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'june_2026_entry_43',
      posting_date: '2026-06-17',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Card settlement (MDR) fee €1.21 — NNV9 + YKKT batch 16.06, VAT-exempt, debited from 2620',
      payload: tag('43', {
        fee_cents: 121,
        bank_account: '2620',
        vendor: 'everypay',
        fee_type: 'pos_terminal',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-06-17: DM53 completion (O.1 LV) — Dainis
  {
    entry_number: '44',
    description: 'DM53 completion €27.10 — LV B2C',
    sellerUserId: DAINIS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_44',
      posting_date: '2026-06-17',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260614-DM53 — LV B2C completion (item €25.00 + ship €2.10 = €27.10)',
      payload: tag('44', {
        order_id: DM53_ID,
        order_number: 'STG-20260614-DM53',
        invoice_number: 'INV-2026-00018',
        consumption_ms: 'LV',
        item_value_cents: 2500,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-19: CHMP completion (O.1 LV) — Aigars
  {
    entry_number: '45',
    description: 'CHMP completion €22.10 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_45',
      posting_date: '2026-06-19',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260612-CHMP — LV B2C completion (item €20.00 + ship €2.10 = €22.10)',
      payload: tag('45', {
        order_id: CHMP_ID,
        order_number: 'STG-20260612-CHMP',
        invoice_number: 'INV-2026-00021',
        consumption_ms: 'LV',
        item_value_cents: 2000,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-19: VA8M completion (O.1 LV) — Aigars
  {
    entry_number: '46',
    description: 'VA8M completion €85.85 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_46',
      posting_date: '2026-06-19',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260613-VA8M — LV B2C completion (item €83.75 + ship €2.10 = €85.85)',
      payload: tag('46', {
        order_id: VA8M_ID,
        order_number: 'STG-20260613-VA8M',
        invoice_number: 'INV-2026-00022',
        consumption_ms: 'LV',
        item_value_cents: 8375,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-19: NNV9 completion (O.3 LT B2C OSS) — Gedas (2nd order)
  {
    entry_number: '47',
    description: 'NNV9 completion €52.70 — LT B2C OSS',
    sellerUserId: GEDAS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_47',
      posting_date: '2026-06-19',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260615-NNV9 — LT B2C OSS completion (item €50.00 + ship €2.70 = €52.70)',
      payload: tag('47', {
        order_id: NNV9_ID,
        order_number: 'STG-20260615-NNV9',
        invoice_number: 'INV-2026-00019',
        consumption_ms: 'LT',
        item_value_cents: 5000,
        shipping_value_cents: 270
      })
    }
  },

  // 2026-06-22: YAHY cart payment (C.2 bank-link → 2620)
  {
    entry_number: '48',
    description: 'YAHY cart €29.90 — bank-link receipt direct to 2620 (Malte Bjarki Mohrmann)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_48',
      posting_date: '2026-06-22',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260622-YAHY cart €29.90 — bank-link (PIS) to 2620',
      payload: tag('48', {
        payment_method: 'bank_link',
        gross_cart_cents: 2990,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: YAHY_ID,
        cart_payment_id: YAHY_CART,
        everypay_payment_id: YAHY_EVERYPAY
      })
    }
  },

  // 2026-06-22: 9Z6S cart payment (C.2 bank-link → 2620)
  {
    entry_number: '49',
    description: '9Z6S cart €19.10 — bank-link receipt direct to 2620 (Malte Bjarki Mohrmann)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_49',
      posting_date: '2026-06-22',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260622-9Z6S cart €19.10 — bank-link (PIS) to 2620',
      payload: tag('49', {
        payment_method: 'bank_link',
        gross_cart_cents: 1910,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: NZ6S_ID,
        cart_payment_id: NZ6S_CART,
        everypay_payment_id: NZ6S_EVERYPAY
      })
    }
  },

  // 2026-06-22: VPM7 cart payment (C.2 bank-link → 2620)
  {
    entry_number: '50',
    description: 'VPM7 cart €37.10 — bank-link receipt direct to 2620 (Malte Bjarki Mohrmann)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_50',
      posting_date: '2026-06-22',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260622-VPM7 cart €37.10 — bank-link (PIS) to 2620',
      payload: tag('50', {
        payment_method: 'bank_link',
        gross_cart_cents: 3710,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: VPM7_ID,
        cart_payment_id: VPM7_CART,
        everypay_payment_id: VPM7_EVERYPAY
      })
    }
  },

  // 2026-06-24: E93F cart payment — hybrid bank-link + buyer wallet (C.2, 3-line)
  {
    entry_number: '51',
    description: 'E93F cart €33.20 — hybrid: €10.70 bank-link + €22.50 buyer wallet; completion deferred to July',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_51',
      posting_date: '2026-06-24',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260624-E93F cart €33.20 — €10.70 bank-link to 2620 + €22.50 buyer wallet debit; order completes in July',
      payload: tag('51', {
        payment_method: 'bank_link',
        gross_cart_cents: 3320,
        buyer_wallet_cents: 2250,
        buyer_id: E93F_BUYER_ID,
        bank_account: '2620',
        order_id: E93F_ID,
        cart_payment_id: E93F_CART,
        everypay_payment_id: E93F_EVERYPAY
      })
    }
  },

  // 2026-06-27: YKKT completion (O.5 EE B2C OSS) — luminarious
  {
    entry_number: '52',
    description: 'YKKT completion €25.20 — EE B2C OSS',
    sellerUserId: LUMINARIOUS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_52',
      posting_date: '2026-06-27',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260615-YKKT — EE B2C OSS completion (item €22.00 + ship €3.20 = €25.20)',
      payload: tag('52', {
        order_id: YKKT_ID,
        order_number: 'STG-20260615-YKKT',
        invoice_number: 'INV-2026-00023',
        consumption_ms: 'EE',
        item_value_cents: 2200,
        shipping_value_cents: 320
      })
    }
  },

  // 2026-06-27: XK5D cart payment — completion deferred to July
  {
    entry_number: '53',
    description: 'XK5D cart €22.10 — bank-link receipt direct to 2620 (Evgenii Dudin); completion deferred to July',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_53',
      posting_date: '2026-06-27',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260627-XK5D cart €22.10 — bank-link (PIS) to 2620; order completes in July',
      payload: tag('53', {
        payment_method: 'bank_link',
        gross_cart_cents: 2210,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: XK5D_ID,
        cart_payment_id: XK5D_CART,
        everypay_payment_id: XK5D_EVERYPAY
      })
    }
  },

  // 2026-06-28: YAHY completion (O.1 LV) — Aigars
  {
    entry_number: '54',
    description: 'YAHY completion €29.90 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_54',
      posting_date: '2026-06-28',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260622-YAHY — LV B2C completion (item €27.80 + ship €2.10 = €29.90)',
      payload: tag('54', {
        order_id: YAHY_ID,
        order_number: 'STG-20260622-YAHY',
        invoice_number: 'INV-2026-00024',
        consumption_ms: 'LV',
        item_value_cents: 2780,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-28: 9Z6S completion (O.1 LV) — Arturs P.
  {
    entry_number: '55',
    description: '9Z6S completion €19.10 — LV B2C',
    sellerUserId: ARTURS_P_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_55',
      posting_date: '2026-06-28',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260622-9Z6S — LV B2C completion (item €17.00 + ship €2.10 = €19.10)',
      payload: tag('55', {
        order_id: NZ6S_ID,
        order_number: 'STG-20260622-9Z6S',
        invoice_number: 'INV-2026-00025',
        consumption_ms: 'LV',
        item_value_cents: 1700,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-29: VPM7 completion (O.1 LV) — beerzinjsh
  {
    entry_number: '56',
    description: 'VPM7 completion €37.10 — LV B2C',
    sellerUserId: BEERZINJSH_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_56',
      posting_date: '2026-06-29',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260622-VPM7 — LV B2C completion (item €35.00 + ship €2.10 = €37.10)',
      payload: tag('56', {
        order_id: VPM7_ID,
        order_number: 'STG-20260622-VPM7',
        invoice_number: 'INV-2026-00026',
        consumption_ms: 'LV',
        item_value_cents: 3500,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-06-29: Anthropic invoice JQYX1OS2-0013 (I.4 EUR path), same-day pay 2610
  {
    entry_number: '57',
    description: 'Anthropic €84.34 — non-EU RC, EUR-billed (Max plan upgrade, net of Pro proration); same-day pay 2610',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'june_2026_entry_57',
      posting_date: '2026-06-29',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Anthropic invoice JQYX1OS2-0013 €84.34 (Max plan €90.00 less €5.66 unused Claude Pro proration) — non-EU RC; EUR-billed, no FX; LV self-assessment 21%',
      counterparty_id: ANTHROPIC_CP_ID,
      payload: tag('57', {
        invoice_currency: 'EUR',
        invoice_net_cents: 8434,
        expense_account: '7730',
        payable_account: '2610',
        vat_treatment: 'non_eu_rc',
        vendor_invoice_number: 'JQYX1OS2-0013',
        vendor_country: 'US',
        invoice_date: '2026-06-26'
      })
    }
  },

  // 2026-06-29: Porkbun invoice 10793486 (I.4 USD FX path), same-day pay 2610
  {
    entry_number: '58',
    description: 'Porkbun $27.29 domain renewal — non-EU RC with FX decomposition; same-day pay 2610',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'june_2026_entry_58',
      posting_date: '2026-06-29',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Porkbun invoice 10793486 $27.29 (secondturn.games domain renewal) — non-EU RC (Article 44 + 196); USD FX decomposition per §F, fee €0.71; LV self-assessment 21%',
      counterparty_id: PORKBUN_CP_ID,
      payload: tag('58', {
        invoice_currency: 'USD',
        expense_account: '7730',
        vat_treatment: 'non_eu_rc',
        vendor_invoice_number: '10793486',
        vendor_country: 'US',
        invoice_date: '2026-06-26',
        // decomposeFx expects decimal currency units here (not cents) — it
        // multiplies internally by 100 to get cents. Verified by hand:
        // (27.29*100)/1.133306 = 2408.00 service value; 24.79*100 - 2408 =
        // 71 fee, matching the invoice's stated €0.71 conversion charge exactly.
        usd_amount: 27.29,
        fx_rate: 1.133306,
        fx_rate_source: 'swedbank_statement',
        bank_amount_eur: 24.79
      })
    }
  },

  // 2026-06-30: Meta ads — EU B2B RC invoice receipt (I.3), 6 June-dated invoices accrued to 5310-META
  {
    entry_number: '59',
    description: 'Meta ads €28.70 — EU B2B RC (6 invoices 2–27 June, code P); self-assess 21% RC VAT €6.03; accrued to 5310-META',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'june_2026_entry_59',
      posting_date: '2026-06-30',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Meta Platforms Ireland ads €28.70 — EU B2B RC (Article 196); 6 invoices FBADS-046-105995227/106002810/106010694/106019627/106026842/106113416 (2–27 June); LV self-assessment 21%',
      counterparty_id: META_CP_ID,
      payload: tag('59', {
        invoice_net_cents: 2870,
        invoice_vat_cents: 0,
        expense_account: '7750',
        vat_treatment: 'eu_b2b_rc',
        vendor_invoice_number: 'FBADS-046-105995227+5',
        vendor_vat_number: 'IE9692928F',
        vendor_country: 'IE',
        invoice_date: '2026-06-30'
      })
    }
  },

  // 2026-06-30: Meta ads payment (I.7) — full €28.70 clears 5310-META (all 6 invoices card-settled within June)
  {
    entry_number: '60',
    description: 'Meta ads payment €28.70 — all 6 June invoices settled on card 2–27 June; 5310-META clears to zero',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'june_2026_entry_60',
      posting_date: '2026-06-30',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Meta ads payment €28.70 — MasterCard settlements 2–27 June clear the June accrual in full (no rollover, unlike May)',
      counterparty_id: META_CP_ID,
      payload: tag('60', {
        payment_cents: 2870,
        payable_account: '5310-META',
        vendor_invoice_number: 'FBADS-046-105995227+5',
        bank_account: '2610'
      })
    }
  },

  // 2026-06-30: Hetzner invoice 088001013289 (I.3 EU B2B RC) — full €13.47 (Apr+May+Jun) booked to June
  {
    entry_number: '61',
    description: 'Hetzner €13.47 — EU B2B RC; first invoice ever received, covers Apr+May+Jun retroactively, booked in full to June (payment deferred to July)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'june_2026_entry_61',
      posting_date: '2026-06-30',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Hetzner invoice 088001013289 €13.47 (CX23 Cloud Server + IPv4, €4.49 × 3 months: 04/2026 + 05/2026 + 06/2026) — EU B2B RC (Article 196); first invoice received for this VPS, booked in full to June since April/May are hard-locked; LV self-assessment 21%',
      counterparty_id: HETZNER_CP_ID,
      payload: tag('61', {
        invoice_net_cents: 1347,
        expense_account: '7730',
        vat_treatment: 'eu_b2b_rc',
        vendor_invoice_number: '088001013289',
        vendor_vat_number: 'DE812871812',
        vendor_country: 'DE',
        invoice_date: '2026-07-04'
      })
    }
  },

  // 2026-06-12: VID VAT payment made (C.11) — clears May's €7.22 payable on 5710-09
  {
    entry_number: '62',
    description: 'VID VAT payment €7.22 — clears May 2026 PVN payable on 5710-09',
    event: {
      event_type: 'vid.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VID_PAYMENT,
      source_doc_id: 'june_2026_entry_62',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'VID VAT payment €7.22 — May 2026 PVN deklarācija payable settled (EDS002F97DB, "PVN maijs 2026"); clears 5710-09 from close_2026_05',
      counterparty_id: VID_CP_ID,
      payload: tag('62', {
        payment_cents: 722,
        vid_payment_ref: 'EDS002F97DB',
        for_period: '2026-05'
      })
    }
  },

  // 2026-06-30: YEB9 cart payment — completion deferred to July (order still `accepted`)
  {
    entry_number: '63',
    description: 'YEB9 cart €37.10 — bank-link receipt direct to 2620 (Xire); completion deferred to July',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_63',
      posting_date: '2026-06-30',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260630-YEB9 cart €37.10 — bank-link (PIS) to 2620; order still `accepted`, completes in July',
      payload: tag('63', {
        payment_method: 'bank_link',
        gross_cart_cents: 3710,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: YEB9_ID,
        cart_payment_id: YEB9_CART,
        everypay_payment_id: YEB9_EVERYPAY
      })
    }
  },

  // 2026-06-07: G6QC cart payment — 100% buyer wallet, no bank leg (C.2-shaped;
  // gross == buyer_wallet_cents so computeCartPayment skips the bank-rail
  // debit entirely). Correction: originally skipped per the live route's gap;
  // that route is fixed on this same branch, so this entry now represents
  // what it would have posted at cart-creation time.
  {
    entry_number: '66',
    description: 'G6QC cart €36.90 — 100% buyer wallet debit (no EveryPay involved)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'june_2026_entry_66',
      posting_date: '2026-06-07',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260607-G6QC cart €36.90 — 100% buyer wallet debit, no EveryPay/bank rail involved',
      payload: tag('66', {
        payment_method: 'bank_link',
        gross_cart_cents: 3690,
        buyer_wallet_cents: 3690,
        buyer_id: AIGARS_USER_ID,
        bank_account: '2620',
        order_id: G6QC_ID,
        cart_payment_id: G6QC_CART,
        everypay_payment_id: `wallet:${G6QC_CART}`
      })
    }
  },

  // 2026-06-12: G6QC completion (O.1 LV) — Kaspars Silavs (first appearance as a seller)
  {
    entry_number: '67',
    description: 'G6QC completion €36.90 — LV B2C',
    sellerUserId: KASPARS_SILAVS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'june_2026_entry_67',
      posting_date: '2026-06-12',
      accounting_period: '2026-06',
      tax_period: '2026-06',
      narrative: 'Order STG-20260607-G6QC — LV B2C completion (item €35.00 + ship €1.90 = €36.90)',
      payload: tag('67', {
        order_id: G6QC_ID,
        order_number: 'STG-20260607-G6QC',
        invoice_number: 'INV-2026-00016',
        consumption_ms: 'LV',
        item_value_cents: 3500,
        shipping_value_cents: 190
      })
    }
  }
];

// ---------------------------------------------------------------------------
// Sanity assertion: 67 emits expected. June's own P.1 close is deferred
// (Swedbank invoice pending, ~15 July) — see file header. The C.11 entry
// settles MAY's payable and is independent of that deferral. Entries 66/67
// correct the G6QC wallet-order gap, added once the cart-wallet-pay route
// fix landed on this same branch.
// ---------------------------------------------------------------------------
export const TOTAL_BACKFILL_ENTRIES = 67;
if (BACKFILL_ENTRIES.length !== TOTAL_BACKFILL_ENTRIES) {
  throw new Error(
    `june-2026-backfill-data.ts: expected ${TOTAL_BACKFILL_ENTRIES} BACKFILL_ENTRIES, ` +
    `got ${BACKFILL_ENTRIES.length}. Update TOTAL_BACKFILL_ENTRIES + the reconcile checkpoints together.`
  );
}
