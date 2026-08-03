/**
 * July 2026 backfill — data table (FULL PASS).
 *
 * **Executed against production on 2026-08-03** (via direct `execute_sql`
 * calls to the `insert_journal_entry` RPC through Supabase MCP — no
 * `SUPABASE_SERVICE_ROLE_KEY` was available in that session to run this file
 * as `npx tsx`, same constraint as june-2026-close-repair.ts. Each entry's
 * exact rpcEntry/rpcLines JSON was computed offline by running the real
 * dispatch()+compute() pipeline against literal counterparty rows queried
 * read-only from production, then posted one at a time and verified). Posted
 * entry IDs: `july_2026_entry_3`=dde28f34-9212-442c-8206-1d49e66184b1,
 * `_4`=fd99755e-8233-4d3c-93b9-a445c3860802, `_5`=40f01be1-a0ba-44aa-a27a-
 * 7511e1b93ac5, `_6`=f2996441-0487-44e6-8fb6-bfd36354eafa, `_7`=e4c35d0c-13a8-
 * 4e7e-8cff-362c31e641dd, `_8`=93033f83-553d-4af6-a30f-8a64b542faed,
 * `_9`=daa69fc3-d509-424e-b31a-3467a07ad182, `_10`=9ec6176b-3890-4774-98ac-
 * 3832a52205db, `_11`=73b7a68a-8957-451c-80a9-bd1f1ef2b4a1, `_12`=463f294d-
 * 399d-4ba9-b9fd-087045ecf804, `_13`=bc0ff07a-f2d1-4b0f-9b21-7bf985087de1,
 * `_14`=bdcf9b7d-728b-4062-8596-ee3d6578e04a, `_15`=09d9a19e-4ce7-4925-bdab-
 * 4cfe951be3fd, `_16`=2419b8b3-d0a4-461c-9512-2b07ec119cd6, `_17`=d8e4f424-
 * ec84-42cf-a2f5-67c14292ce7b, `_18`=d8e64eae-b455-4720-a352-3ea72627bc30,
 * `_19`=ed10d3a9-22c6-47ac-8038-b22955511903, `_20`=792cd0fd-ab6a-49eb-ac6f-
 * d8a7877aa9b5, `_21`=3623012d-b1cd-4b81-b8f2-6a6bdc2e646f, `_22`=0ab9eea8-
 * 5e30-4053-88af-ef393bdaffbe, `_23`=e0cbd890-1851-4b90-b902-e23f070c792e,
 * `_24`=76bb825b-75d3-4f4f-917f-e566fe0580e3, `_25`=e3096695-fa76-4d5d-8ef8-
 * a0c591b6b68f, `_26`=806fc6af-13bf-4c82-ba50-930d293397b1, `_27`=b1a6a847-
 * 3189-405d-a8ce-5e5ecd75816f, `_28`=805ee185-300e-4f37-86ce-bb702fafa796,
 * `_29`=01592b16-d592-4bb0-8459-25d8f19ef95d, `_30`=58e28c6e-e98c-4e76-b608-
 * f7ae172ab537, `_31`=b9bfe613-9eda-414f-8b98-d8b7e068bde4, `_32`=30055b1a-
 * d9a5-45b8-a752-c93c9b30759c. New counterparties created: Arturs P. (buyer)
 * =c3cfb279-e76d-4b72-88fd-6d61ac53430f, Rokas (seller, LT, first completion)
 * =11e2039f-963f-462d-9f0e-cbcb331ddff7.
 *
 * Verified post-run: global Σdebit=Σcredit through 2026-07-31 (909324=909324),
 * bank checkpoints match exactly (2610=38702¢ incl. the documented €10.35
 * Q2.2026-VID gap, 2620=63089¢ exact match, 2630=9720¢ = UJRJ+4DUR in-transit),
 * 5310-HE and 5310-UN cleared to 0, 5310-META rolls -500¢ to August, no
 * unattributed 5351 wallet lines. `bank_statement_closures` recorded for
 * 2026-07 (2610=37667¢, 2620=63089¢) with companion `bank_closure.recorded`
 * audit events. The premature `close_2026_07` P.1 was reversed (see
 * `july-2026-close-p1-reversal.ts`) — a fresh, correct July P.1 is still a
 * separate, later step. Period 2026-07 checklist item 2 (bank reconciliation)
 * fails on 2610 by design (the €10.35 gap); item 3 (wallet integrity) will
 * show a nominal mismatch if checked after 2026-08-03 because it compares GL
 * frozen at 31.07 against the live `wallets` table, which by then already
 * reflects the 03.08 WD-2026-00005 withdrawal (€45.00) — not a backfill
 * defect. Item 8 (VAT consolidation posted) will show `pass` because it only
 * checks for existence of a P.1/P.3 entry in the period and doesn't know
 * `close_2026_07` was reversed — both the original and its reversal carry
 * `type_id='P.1'` and `accounting_period='2026-07'`. Re-running this file's
 * emits against production now is safe and will report `idempotent_skip` for
 * every entry.
 *
 * Extends the first (partial) pass — entries 1-2 (XK5D, E93F completions,
 * both deferred from June) are UNCHANGED and their numbering is reserved.
 * Entries 3-32 are the full July close: the remaining 7 July order
 * completions, the 8 cart_checkout_groups that took payment in July, the
 * July vendor invoice / bank fee activity, the C.10 inter-account transfer,
 * and the C.11 VID VAT payment for June's PVN.
 *
 * NOT in this file (deferred / out of scope for this pass):
 *   - UJRJ's still-in-transit €34.10 card settlement — explicit user decision
 *     to skip; stays unresolved, carries in 2630 indefinitely until it
 *     surfaces on a future statement.
 *   - The `close_2026_07` reversal — separate script
 *     (`scripts/july-2026-close-p1-reversal.ts`), mirroring the
 *     june-2026-close-repair.ts reversal pattern. A fresh, correct July P.1
 *     is deliberately NOT posted here — every prior month (April/May/June)
 *     treated its own P.1 close as a separate, later step after the month's
 *     activity backfill reconciled; July follows the same discipline.
 *   - The Q2.2026 VID payment (€10.35, ref EDS003091DD) debited 11.07 — see
 *     header note below. NOT posted; open question for human review.
 *   - A new Hetzner invoice for July hosting — none evidenced on the
 *     statement (only the June-accrued invoice's payment leg, entry 9).
 *
 * Source of truth: orders + cart_checkout_groups tables (queried 2026-08-03,
 * read-only via Supabase MCP against tfxqbtcdkzdwfgsivvet), cross-referenced
 * against the two Swedbank statements (2610 operating, 2620 e-commerce) for
 * 01.07-03.08.2026.
 *
 * The 7 completions (STG codes YEB9, 8Z68, WRRJ, YRQF, 4CUP, ABMV, HXHB):
 *   - YEB9: cart already posted in June (june_2026_entry_63, bank-link
 *     €37.10) — only the O.1 completion is missing here (entry 3... wait,
 *     see TOTAL_BACKFILL_ENTRIES note — numbered per the chronological table
 *     below).
 *   - 8Z68: 100%-wallet-funded cart (cart_checkout_groups row's OWN
 *     order_number is 'STG-20260706-B8NR' — a cart-level code distinct from
 *     the per-order code 8Z68; buyer/total/wallet_debit_cents all line up
 *     exactly, confirmed via query). Wallet-cart shape mirrors June's G6QC
 *     fix exactly (entries 66/67 there): everypay.payment_confirmed,
 *     payment_method='bank_link' (cosmetic — gross==wallet so the bank-rail
 *     leg is skipped either way), everypay_payment_id=`wallet:<cart_id>`.
 *   - WRRJ / YRQF / ABMV: bank-link, land direct in 2620, dates match
 *     statement CRDT lines exactly (08.07/12.07/15.07).
 *   - 4CUP / HXHB: card, land in 2630 first; each is a SINGLE-order card
 *     settlement batch (not combined) — 4CUP is the entirety of the 07.07
 *     POS batch (gross €21.20, KOM €0.49 netted at settlement per the
 *     mdr_fee_cents C.3 feature), HXHB is the entirety of the 23.07 POS
 *     batch (gross €17.10, KOM €0.21).
 *   - KL77: cart paid (bank-link, 29.07, €23.10) but order status is still
 *     `shipped` (completed_at null, invoice_number null) — verified via
 *     direct query, NOT assumed. Cart-payment entry only, no O.x.
 *   - 4DUR (STG-20260730-4DUR): an 8th cart_checkout_group NOT in the
 *     originally-given 7-code list — discovered via direct query of ALL carts
 *     with created_at in July. Card payment €63.10, matches the 01.08 POS
 *     batch (gross €63.10, KOM €0.76, net €62.34) — i.e. this card CHARGE
 *     happened in July (30.07) but its SETTLEMENT lands in August, out of
 *     scope (mirrors UJRJ's June precedent exactly: the C.1 card-clearing
 *     leg posts in the month the charge happened; the C.3 settlement posts
 *     whenever it actually clears). Order status is `shipped`
 *     (completed_at null) — cart-payment entry only, no O.x. This is the 8th
 *     of the "8 cart_checkout_groups" — the other 7 are WRRJ/YRQF/4CUP/ABMV/
 *     HXHB/KL77 (unposted) + YEB9 (already posted in June, hence not one of
 *     the "8 unposted").
 *
 * Vendor / bank fee activity (see script header comments below on individual
 * entries for full sourcing):
 *   - C.10 internal transfer €407.46 (2620 → 2610), 07.07.
 *   - 3 old-model I.5 exempt Swedbank fees (statement narrative only, no
 *     separate VAT line): €0.88 (May transaction-processing fee, paid
 *     06.07), €2.82 (June transaction-processing fee, paid 06.07), €5.20
 *     (June payment-initiation commission, paid 07.07) — same shape as
 *     June's own entry_18 for May's fee.
 *   - I.7 Hetzner payment €13.47 (07.07) — clears the FULL 5310-HE payable
 *     from June's entry_61 (verified via query: pre-July 5310-HE net payable
 *     was exactly €13.47). NOT a new invoice.
 *   - I.7 Unisend payment €43.92 (08.07) — clears the FULL 5310-UN payable
 *     from june_2026_entry_69 (verified: that entry posted ONLY the
 *     invoice-recognition leg — expense + input VAT + Cr 5310-UN — with NO
 *     cash-clearing leg; pre-July 5310-UN net payable was exactly €43.92).
 *   - C.11 VID VAT payment €13.66 (11.07) — clears June's PVN payable on
 *     5710-09. OPEN DISCREPANCY: close_2026_06's posted P.1 credited
 *     5710-09 by only €13.59 (verified via query), a 7-cent shortfall vs the
 *     actual €13.66 paid. Posted at the ACTUAL paid amount (cash is ground
 *     truth) — this deliberately leaves a €0.07 debit residual on 5710-09
 *     after this entry, flagged for human investigation (likely a
 *     GL-vs-filed-declaration rounding gap) rather than silently plugged.
 *   - I.1 new Swedbank e-commerce platform invoice, net €2.10 (€0.90
 *     transaction processing + €1.20 payment-initiation commission) + 21%
 *     VAT €0.44 (€0.19 + €0.25) = €2.54 gross, same-day pay 2610, 15.07 —
 *     mirrors June's close-repair V0000897245 shape exactly (the first time
 *     Swedbank split VAT onto these specific line items; both the June
 *     precedent AND this July invoice show it, so treating it as the new
 *     steady-state going forward).
 *   - I.4 Anthropic €18.00 (EUR path, non-EU RC, same-day pay 2610), 28.07 —
 *     same amount as June's JQYX1OS2-0012 (recurring Claude Pro subscription).
 *     Invoice number confirmed from the real Anthropic invoice PDF:
 *     JQYX1OS2-0014, issued 2026-07-26 (Claude Pro Jul 26–Aug 26), 0% tax /
 *     reverse charge — matches the planned non_eu_rc treatment exactly.
 *   - I.3 Meta ads accrual €19.42 (EU B2B RC, IE) + I.7 payment €14.42, 31.07
 *     — 4 card debits total €19.42 (28.07 €4.42, 30.07 €5.00, 31.07 €5.00,
 *     and a 4th €5.00 booked 02.08 but narrative-dated 31.07). Judgment call:
 *     the ACCRUAL (I.3) includes all 4 — accrual timing follows when the ad
 *     spend was economically incurred (the narrative date), matching the
 *     May→June rollover precedent. The PAYMENT (I.7) clears only the 3 that
 *     actually left cash by 03.08 (€14.42) — the 4th (€5.00, cash-cleared
 *     02.08) rolls to August's backfill, mirroring May's €6.00 rollover
 *     exactly. All 4 invoice numbers confirmed from the real Meta/FBADS
 *     invoice PDFs, matched to their bank charges by transaction timestamp:
 *     FBADS-046-106259359 (€4.42, txn Jul 27 06:04), FBADS-046-106267577
 *     (€5.00, txn Jul 28 22:04), FBADS-046-106273729 (€5.00, txn Jul 30
 *     03:42), FBADS-046-106285148 (€5.00, txn Jul 31 23:28 — this is the one
 *     that cash-clears 02.08 and rolls to August). A 5th Meta invoice
 *     (FBADS-046-106293368, txn Aug 2 13:29, €5.00) was also supplied but
 *     falls entirely in August (billing period 31.07–02.08, no July bank
 *     charge for it) — out of scope for this pass, belongs to August's
 *     backfill instead.
 *   - 2 monthly account-maintenance fees, €5.00 each (2610 default account,
 *     2620 override), both 31.07 — I.5 exempt (no precedent fee_type exists
 *     for "account maintenance" specifically; reusing 'pis_commission' as
 *     the generic Swedbank-service-fee bucket, since I.5's routing only
 *     checks fee_type for dispatch, not for narrative accuracy).
 *
 * OPEN QUESTIONS surfaced during this backfill (see report — NOT resolved
 * here, NOT silently guessed):
 *   1. Q2.2026 VID payment €10.35 (11.07, ref EDS003091DD) — very likely the
 *      quarterly OSS return remittance (Union OSS scheme mandates quarterly
 *      filing per Article 364, distinct from STG's MONTHLY domestic PVN
 *      filing) covering LT+EE OSS liability for Apr-Jun 2026. GL's 5711+5712
 *      combined credit balance through 30.06.2026 is €9.17 (LT €3.32 + EE
 *      €5.85) — a €1.18 gap vs the €10.35 paid. The `oss_submissions` table
 *      has ZERO rows (confirms the "mark filed" staff workflow has never
 *      been used) and no engine type exists yet for crediting down 5711/5712
 *      via cash payment (C.11 only targets 5710-09). NOT posted — needs
 *      human confirmation of (a) what this payment actually is, (b) the
 *      €1.18 gap, (c) whether a new engine type is needed.
 *   2. The 7-cent 5710-09 residual from the June PVN payment (see I.7... C.11
 *      entry above).
 */

import './_load-env';

import type { PostingEvent } from '@/lib/accounting/types';

export interface BackfillEntry {
  readonly entry_number: string;
  readonly description: string;
  readonly event: PostingEvent;
  readonly sellerUserId?: string;
  /**
   * When set, the runner resolves-or-creates a 'buyer' counterparty for this
   * user_id (resolveOrCreateBuyerCounterparty, mirroring the seller lazy-init)
   * immediately before emit, then overwrites
   * event.payload.buyer_counterparty_id. Only needed for 100%-wallet or
   * hybrid bank+wallet cart payments (buyer_wallet_cents > 0) — mirrors
   * june-2026-close-repair.ts's G6QC/E93F handling.
   */
  readonly buyerUserId?: string;
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

// No new vendor counterparties this pass — Hetzner, Anthropic, Meta, Unisend,
// Swedbank, VID all already exist (Phase 0 / April / May / June) and are
// referenced by id only. Verified via query 2026-08-03.
export const BACKFILL_COUNTERPARTIES: readonly BackfillCounterparty[] = [];

const SOURCE_DOC_TYPE_ORDER = 'order';
const SOURCE_DOC_TYPE_CART_PAYMENT = 'cart_payment';
const SOURCE_DOC_TYPE_VENDOR_INVOICE = 'vendor_invoice';
const SOURCE_DOC_TYPE_VENDOR_PAYMENT = 'vendor_payment';
const SOURCE_DOC_TYPE_BANK_FEE = 'bank_fee';
const SOURCE_DOC_TYPE_SETTLEMENT = 'everypay_settlement';
const SOURCE_DOC_TYPE_INTERNAL_TRANSFER = 'internal_transfer';
const SOURCE_DOC_TYPE_VID_PAYMENT = 'vid_payment';

const XK5D_ID = '5ee961af-ad8c-4080-b64e-5ae160ed9ff4';
const E93F_ID = '2147e415-837b-4480-8935-8c07095ea3e1';

const KARLIS_USER_ID = 'da426099-5fdd-4a35-a802-e6fc905714f9';
const SILVOS_USER_ID = 'd508c35a-0a91-4a3d-b645-c6ab204893a8';

// ---------------------------------------------------------------------------
// Existing counterparty IDs referenced (not re-seeded — already exist from
// Phase 0 / April / May / June backfills, confirmed via query 2026-08-03).
// ---------------------------------------------------------------------------
const ANTHROPIC_CP_ID = 'a2222222-2222-4222-8222-222222222222';
const META_CP_ID = 'a3333333-3333-4333-8333-333333333333';
const SWEDBANK_CP_ID = 'a4444444-4444-4444-8444-444444444444';
const HETZNER_CP_ID = 'a8888888-8888-4888-8888-888888888888';
const UNISEND_CP_ID = 'a9999999-9999-4999-8999-999999999999';
const VID_CP_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Order / cart constants (orders + cart_checkout_groups tables, queried
// 2026-08-03). Seller/buyer user_ids resolved via query; sellers already
// carrying a counterparty from a prior month are referenced anyway (uniform
// runner resolution path — existing lookup finds the row, doesn't duplicate).
// ---------------------------------------------------------------------------

const AIGARS_USER_ID = '630f6e7f-95cb-41fa-a98f-a4d199aa32fe'; // seller: YEB9, 8Z68, ABMV, HXHB
const KASPARS_SILAVS_USER_ID = 'd8f7acef-acb1-44e6-a525-4e58817f679d'; // seller: YRQF
const LUMINARIOUS_USER_ID = 'ee3b9fe6-c074-411a-91bb-c3d1f9319298'; // seller: 4CUP (EE)
const ROKAS_USER_ID = 'e17ad88e-d17d-4a95-8297-7afc5d559660'; // seller: WRRJ (LT) — NEW, no counterparty yet
const ARTURS_P_USER_ID = 'f4d4492d-d3b4-4c59-8ca6-d1bff83a3d75'; // buyer: 8Z68 (100% wallet)

const YEB9_ID = '6797e321-e92a-4f4d-ae8a-0ff7c8086412';
// YEB9's cart payment already posted in June (june_2026_entry_63, bank-link
// €37.10 direct to 2620) — no cart-payment entry needed here, completion only.

const B8NR_8Z68_ID = '638973d2-26fe-4fe3-88f9-ce3a94fd4469';
const B8NR_8Z68_CART = '7add5047-e67c-4f2e-b51a-4153963f97a1';

const WRRJ_ID = 'a6b9f371-2af7-4162-b941-2745204bfaee';
const WRRJ_CART = '1fb820a0-6949-483e-b67c-44f3846eb644';
const WRRJ_EVERYPAY = '39594284b84f3b64c8127090e4f599aa490a610649ffbfdfda51a9c50ae7dbb2';

const YRQF_ID = '62747347-c44d-457e-8fb2-59fcf0a5c53e';
const YRQF_CART = '003e7125-b5a4-4e40-a1e0-7695d0235252';
const YRQF_EVERYPAY = '724aa1f5e19abbcef8793e1686c26b882a296f33570f437b17fb9cf8a5451e9f';

const CUP4_ID = 'cbb05059-465e-4c3b-8733-d406d7c52ec8';
const CUP4_CART = '6d72403a-bb6e-456f-b24d-7216c0420297';
const CUP4_EVERYPAY = '40635da95312cae0e749f148a3653ed6844dc43d9e48300fe2ba540f53cbec61';

const ABMV_ID = 'b992a675-db38-4ffc-bcb9-72737e3e1381';
const ABMV_CART = 'aea54c86-8c08-4b7e-a3db-693014128c07';
const ABMV_EVERYPAY = 'add447ecaf8a63a6c0a70653723c6403317a45d70727757a223877cf030c5142';

const HXHB_ID = '26fa4bfc-b0db-4c4e-845c-f65c56743774';
const HXHB_CART = 'ad65cbc8-f8fd-4a17-aa4b-15d74251d3e3';
const HXHB_EVERYPAY = '89d6e1556aad0534d0e1d1aa18b317d2d2b002dfd0c3a75ccfd2a087cb57bf88';

// KL77 — cart paid (bank-link, 29.07, €23.10) but order status is `shipped`
// (verified via query: completed_at IS NULL, invoice_number IS NULL). Cart
// payment only, no O.x completion.
const KL77_CART = '236d0e4b-4099-4961-8e62-1dbc4428a438';
const KL77_EVERYPAY = 'e03e4724b07d98f836a5fa4eb4334fb115de678837b0e63c3af5976ad0e3140d';

// 4DUR — 8th cart_checkout_group, discovered via broad query (not in the
// originally-given 7-code list). Card payment €63.10 30.07; settlement lands
// 01.08 (August POS batch, out of scope). Order status `shipped` — cart
// payment only, no O.x completion.
const DUR4_CART = 'a0616084-a3e7-4cbf-8a10-d490829c2fe3';
const DUR4_EVERYPAY = '6ea579f9a98f022304e765d72b4c6af09c6f9bf8095dba01ea14165792d91f05';

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
  },

  // 2026-07-05: 4CUP cart payment (C.1 card → 2630)
  {
    entry_number: '3',
    description: '4CUP cart €21.20 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_3',
      posting_date: '2026-07-05',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260705-4CUP cart €21.20 — card to 2630 EveryPay clearing',
      payload: tag('3', {
        payment_method: 'card',
        gross_cart_cents: 2120,
        buyer_wallet_cents: 0,
        order_id: CUP4_ID,
        cart_payment_id: CUP4_CART,
        everypay_payment_id: CUP4_EVERYPAY
      })
    }
  },

  // 2026-07-06: 8Z68 cart payment — 100% buyer wallet, no bank leg (C.2-shaped;
  // mirrors June's G6QC fix exactly). Cart row's own order_number is
  // STG-20260706-B8NR (cart-level code, distinct from the per-order 8Z68 code)
  // — buyer/total/wallet_debit_cents confirmed matching via query.
  {
    entry_number: '4',
    description: '8Z68 cart €12.90 — 100% buyer wallet debit (no EveryPay involved)',
    buyerUserId: ARTURS_P_USER_ID,
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_4',
      posting_date: '2026-07-06',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260706-8Z68 (cart row STG-20260706-B8NR) cart €12.90 — 100% buyer wallet debit, no EveryPay/bank rail involved',
      payload: tag('4', {
        payment_method: 'bank_link',
        gross_cart_cents: 1290,
        buyer_wallet_cents: 1290,
        buyer_id: ARTURS_P_USER_ID,
        bank_account: '2620',
        order_id: B8NR_8Z68_ID,
        cart_payment_id: B8NR_8Z68_CART,
        everypay_payment_id: `wallet:${B8NR_8Z68_CART}`
      })
    }
  },

  // 2026-07-06: Swedbank e-commerce transaction-processing fee (I.5 exempt) —
  // May 2026's fee, billed/debited in July. Same shape as June's own entry_18
  // for May's fee.
  {
    entry_number: '5',
    description: 'Swedbank e-commerce transaction-processing fee €0.88 — VAT-exempt financial service (May fee billed in July)',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'july_2026_entry_5',
      posting_date: '2026-07-06',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Swedbank AS e-commerce transaction-processing fee €0.88 (E-KOMERCIJAS DARĪJUMA APSTRĀDES MAKSA 05/2026) — PVN likums Article 52 exempt',
      payload: tag('5', {
        fee_cents: 88,
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-07-06: Swedbank e-commerce transaction-processing fee (I.5 exempt) —
  // June 2026's fee, billed/debited in July.
  {
    entry_number: '6',
    description: 'Swedbank e-commerce transaction-processing fee €2.82 — VAT-exempt financial service (June fee billed in July)',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'july_2026_entry_6',
      posting_date: '2026-07-06',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Swedbank AS e-commerce transaction-processing fee €2.82 (E-KOMERCIJAS DARĪJUMA APSTRĀDES MAKSA 06/2026) — PVN likums Article 52 exempt',
      payload: tag('6', {
        fee_cents: 282,
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-07-07: Internal bank transfer (C.10), 2620 → 2610
  {
    entry_number: '7',
    description: 'Internal transfer €407.46 — 2620 e-commerce settlement → 2610 operating',
    event: {
      event_type: 'bank.internal_transfer',
      source_doc_type: SOURCE_DOC_TYPE_INTERNAL_TRANSFER,
      source_doc_id: 'july_2026_entry_7',
      posting_date: '2026-07-07',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Internal transfer €407.46 — Maksājums starp saviem kontiem, 2620 (LV24…4950 3) → 2610 (LV89…5377 7)',
      payload: tag('7', {
        transfer_cents: 40746,
        from_account: '2620',
        to_account: '2610'
      })
    }
  },

  // 2026-07-07: Swedbank payment-initiation commission (I.5 exempt) — June
  // 2026's commission, billed/debited in July.
  {
    entry_number: '8',
    description: 'Swedbank payment-initiation commission €5.20 — VAT-exempt financial service (June commission billed in July)',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'july_2026_entry_8',
      posting_date: '2026-07-07',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Swedbank AS payment-initiation commission €5.20 (Maksājumu ierosināšanas darījumu komisija; E-komercijas platforma; EPLV_SECONDTURN; 06.2026) — PVN likums Article 52 exempt',
      payload: tag('8', {
        fee_cents: 520,
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-07-07: Hetzner payment (I.7) — clears the FULL €13.47 payable from
  // June's entry_61 (verified: pre-July 5310-HE net payable was exactly
  // €13.47). NOT a new invoice — no new Hetzner invoice evidenced this month.
  {
    entry_number: '9',
    description: 'Hetzner payment €13.47 — clears June-accrued payable (entry_61) in full',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'july_2026_entry_9',
      posting_date: '2026-07-07',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Hetzner Online GmbH payment €13.47 — card charge clears the June-accrued invoice 088001013289 payable (june_2026_entry_61) in full',
      counterparty_id: HETZNER_CP_ID,
      payload: tag('9', {
        payment_cents: 1347,
        payable_account: '5310-HE',
        vendor_invoice_number: '088001013289',
        bank_account: '2610'
      })
    }
  },

  // 2026-07-07: 4CUP EveryPay settlement (C.3 → 2620, MDR fee netted at
  // settlement) — this batch is the ENTIRETY of 4CUP's card charge (single
  // order, not combined).
  {
    entry_number: '10',
    description: '4CUP EveryPay settlement €20.71 net (€21.20 gross less €0.49 MDR fee netted at settlement) — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'july_2026_entry_10',
      posting_date: '2026-07-07',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'EveryPay settlement €20.71 net — STG-20260705-4CUP card payment (POS DAR 060726/21.20, KOM 0.49) released from 2630 to 2620',
      payload: tag('10', {
        settlement_cents: 2071,
        mdr_fee_cents: 49,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260707-2071',
        batch_date: '2026-07-05',
        settlement_value_date: '2026-07-07',
        included_txn_refs: [CUP4_EVERYPAY]
      })
    }
  },

  // 2026-07-08: WRRJ cart payment (C.2 bank-link → 2620)
  {
    entry_number: '11',
    description: 'WRRJ cart €72.50 — bank-link receipt direct to 2620 (Kristaps Mežvinskis)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_11',
      posting_date: '2026-07-08',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260707-WRRJ cart €72.50 — bank-link (PIS) to 2620 (ref st304394)',
      payload: tag('11', {
        payment_method: 'bank_link',
        gross_cart_cents: 7250,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: WRRJ_ID,
        cart_payment_id: WRRJ_CART,
        everypay_payment_id: WRRJ_EVERYPAY
      })
    }
  },

  // 2026-07-08: YEB9 completion (O.1 LV) — Aigars; cart already posted in June
  {
    entry_number: '12',
    description: 'YEB9 completion €37.10 — LV B2C; June-paid, July-completing order',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_12',
      posting_date: '2026-07-08',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260630-YEB9 — LV B2C completion (item €35.00 + ship €2.10 = €37.10); cart paid 30.06 (June backfill entry 63), completes in July',
      payload: tag('12', {
        order_id: YEB9_ID,
        order_number: 'STG-20260630-YEB9',
        invoice_number: 'INV-2026-00029',
        consumption_ms: 'LV',
        item_value_cents: 3500,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-07-08: Unisend payment (I.7) — clears the FULL €43.92 payable from
  // june_2026_entry_69 (verified: that entry posted only the invoice
  // recognition leg, no cash-clearing leg; pre-July 5310-UN net payable was
  // exactly €43.92).
  {
    entry_number: '13',
    description: 'Unisend payment €43.92 — clears June-accrued invoice 2601925 payable (june_2026_entry_69) in full',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'july_2026_entry_13',
      posting_date: '2026-07-08',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Unisend Latvia SIA payment €43.92 — clears invoice 2601925 (june_2026_entry_69, recognized 30.06 but not yet cash-settled) payable in full',
      counterparty_id: UNISEND_CP_ID,
      payload: tag('13', {
        payment_cents: 4392,
        payable_account: '5310-UN',
        vendor_invoice_number: '2601925',
        bank_account: '2610'
      })
    }
  },

  // 2026-07-09: 8Z68 completion (O.1 LV) — Aigars
  {
    entry_number: '14',
    description: '8Z68 completion €12.90 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_14',
      posting_date: '2026-07-09',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260706-8Z68 — LV B2C completion (item €11.00 + ship €1.90 = €12.90); 100% wallet-funded cart',
      payload: tag('14', {
        order_id: B8NR_8Z68_ID,
        order_number: 'STG-20260706-8Z68',
        invoice_number: 'INV-2026-00030',
        consumption_ms: 'LV',
        item_value_cents: 1100,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-07-11: WRRJ completion (O.3 LT B2C OSS) — Rokas (first completion,
  // new seller — lazy-inits with tax_status='private', routes O.3 not O.2)
  {
    entry_number: '15',
    description: 'WRRJ completion €72.50 — LT B2C OSS; first completion for this seller',
    sellerUserId: ROKAS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_15',
      posting_date: '2026-07-11',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260707-WRRJ — LT B2C OSS completion (item €70.00 + ship €2.50 = €72.50)',
      payload: tag('15', {
        order_id: WRRJ_ID,
        order_number: 'STG-20260707-WRRJ',
        invoice_number: 'INV-2026-00031',
        consumption_ms: 'LT',
        item_value_cents: 7000,
        shipping_value_cents: 250
      })
    }
  },

  // 2026-07-11: VID VAT payment made (C.11) — clears June's PVN payable on
  // 5710-09. OPEN DISCREPANCY: close_2026_06 posted only €13.59 to 5710-09
  // (verified via query); actual payment is €13.66 — a 7-cent shortfall.
  // Posted at the actual paid amount (cash is ground truth); leaves a €0.07
  // debit residual on 5710-09 flagged for human investigation, NOT silently
  // plugged.
  {
    entry_number: '16',
    description: 'VID VAT payment €13.66 — June 2026 PVN payable (7-cent discrepancy vs GL €13.59 flagged, not resolved)',
    event: {
      event_type: 'vid.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VID_PAYMENT,
      source_doc_id: 'july_2026_entry_16',
      posting_date: '2026-07-11',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'VID VAT payment €13.66 — June 2026 PVN deklarācija payable settled (EDS003091E0, "PVN jūnijs 2026"); clears 5710-09 from close_2026_06. OPEN QUESTION: close_2026_06 posted only €13.59 to 5710-09 — 7-cent shortfall vs this actual payment, NOT resolved here, flagged for human review (likely GL-vs-filed-declaration rounding gap).',
      counterparty_id: VID_CP_ID,
      payload: tag('16', {
        payment_cents: 1366,
        vid_payment_ref: 'EDS003091E0',
        for_period: '2026-06'
      })
    }
  },

  // 2026-07-12: YRQF cart payment (C.2 bank-link → 2620)
  {
    entry_number: '17',
    description: 'YRQF cart €16.90 — bank-link receipt direct to 2620 (Sandis Vinogradovs)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_17',
      posting_date: '2026-07-12',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260712-YRQF cart €16.90 — bank-link (PIS) to 2620 (ref st597351)',
      payload: tag('17', {
        payment_method: 'bank_link',
        gross_cart_cents: 1690,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: YRQF_ID,
        cart_payment_id: YRQF_CART,
        everypay_payment_id: YRQF_EVERYPAY
      })
    }
  },

  // 2026-07-15: YRQF completion (O.1 LV) — Kaspars Silavs
  {
    entry_number: '18',
    description: 'YRQF completion €16.90 — LV B2C',
    sellerUserId: KASPARS_SILAVS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_18',
      posting_date: '2026-07-15',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260712-YRQF — LV B2C completion (item €15.00 + ship €1.90 = €16.90)',
      payload: tag('18', {
        order_id: YRQF_ID,
        order_number: 'STG-20260712-YRQF',
        invoice_number: 'INV-2026-00032',
        consumption_ms: 'LV',
        item_value_cents: 1500,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-07-15: ABMV cart payment (C.2 bank-link → 2620)
  {
    entry_number: '19',
    description: 'ABMV cart €6.90 — bank-link receipt direct to 2620 (Sandis Vinogradovs)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_19',
      posting_date: '2026-07-15',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260715-ABMV cart €6.90 — bank-link (PIS) to 2620 (ref st617879)',
      payload: tag('19', {
        payment_method: 'bank_link',
        gross_cart_cents: 690,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        order_id: ABMV_ID,
        cart_payment_id: ABMV_CART,
        everypay_payment_id: ABMV_EVERYPAY
      })
    }
  },

  // 2026-07-15: Swedbank e-commerce platform invoice (I.1, LV standard VAT),
  // covers 01-15.07.2026, same-day pay 2610. First July invoice to itemize
  // VAT explicitly on these line items — mirrors June's close-repair
  // V0000897245 shape exactly.
  {
    entry_number: '20',
    description: 'Swedbank e-commerce platform invoice €2.54 (€2.10 net + €0.44 VAT) — same-day pay 2610',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'july_2026_entry_20',
      posting_date: '2026-07-15',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Swedbank e-commerce platform invoice 6012050226 (01-15.07.2026) — transaction processing €0.90 + VAT €0.19; payment-initiation commission €1.20 + VAT €0.25; net €2.10 + 21% LV VAT €0.44 = €2.54; paid same-day from 2610',
      counterparty_id: SWEDBANK_CP_ID,
      payload: tag('20', {
        invoice_net_cents: 210,
        invoice_vat_cents: 44,
        expense_account: '7710',
        payable_account: '2610',
        vat_treatment: 'standard',
        vendor_invoice_number: '6012050226',
        vendor_vat_number: 'LV40003074764',
        invoice_date: '2026-07-15'
      })
    }
  },

  // 2026-07-17: 4CUP completion (O.5 EE B2C OSS) — luminarious
  {
    entry_number: '21',
    description: '4CUP completion €21.20 — EE B2C OSS',
    sellerUserId: LUMINARIOUS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_21',
      posting_date: '2026-07-17',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260705-4CUP — EE B2C OSS completion (item €18.00 + ship €3.20 = €21.20)',
      payload: tag('21', {
        order_id: CUP4_ID,
        order_number: 'STG-20260705-4CUP',
        invoice_number: 'INV-2026-00033',
        consumption_ms: 'EE',
        item_value_cents: 1800,
        shipping_value_cents: 320
      })
    }
  },

  // 2026-07-21: HXHB cart payment (C.1 card → 2630)
  {
    entry_number: '22',
    description: 'HXHB cart €17.10 — card receipt to 2630 clearing',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_22',
      posting_date: '2026-07-21',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260721-HXHB cart €17.10 — card to 2630 EveryPay clearing',
      payload: tag('22', {
        payment_method: 'card',
        gross_cart_cents: 1710,
        buyer_wallet_cents: 0,
        order_id: HXHB_ID,
        cart_payment_id: HXHB_CART,
        everypay_payment_id: HXHB_EVERYPAY
      })
    }
  },

  // 2026-07-23: HXHB EveryPay settlement (C.3 → 2620, MDR fee netted at
  // settlement) — this batch is the ENTIRETY of HXHB's card charge (single
  // order, not combined).
  {
    entry_number: '23',
    description: 'HXHB EveryPay settlement €16.89 net (€17.10 gross less €0.21 MDR fee netted at settlement) — clearing 2630 → 2620',
    event: {
      event_type: 'everypay.daily_settlement_received',
      source_doc_type: SOURCE_DOC_TYPE_SETTLEMENT,
      source_doc_id: 'july_2026_entry_23',
      posting_date: '2026-07-23',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'EveryPay settlement €16.89 net — STG-20260721-HXHB card payment (POS DAR 220726/17.10, KOM 0.21) released from 2630 to 2620',
      payload: tag('23', {
        settlement_cents: 1689,
        mdr_fee_cents: 21,
        settlement_bank_account: '2620',
        everypay_settlement_id: 'stg-pos-20260723-1689',
        batch_date: '2026-07-21',
        settlement_value_date: '2026-07-23',
        included_txn_refs: [HXHB_EVERYPAY]
      })
    }
  },

  // 2026-07-23: ABMV completion (O.1 LV) — Aigars
  {
    entry_number: '24',
    description: 'ABMV completion €6.90 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_24',
      posting_date: '2026-07-23',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260715-ABMV — LV B2C completion (item €5.00 + ship €1.90 = €6.90)',
      payload: tag('24', {
        order_id: ABMV_ID,
        order_number: 'STG-20260715-ABMV',
        invoice_number: 'INV-2026-00034',
        consumption_ms: 'LV',
        item_value_cents: 500,
        shipping_value_cents: 190
      })
    }
  },

  // 2026-07-28: Anthropic invoice (I.4 EUR path), same-day pay 2610.
  // Invoice number JQYX1OS2-0014 confirmed from the real Anthropic invoice
  // PDF (issued 2026-07-26, due same day, 0% tax / reverse charge — matches
  // the non_eu_rc treatment below exactly). posting_date stays on the bank
  // booking date (28.07, matching the statement's DBIT entry) per this
  // file's same-day-pay dating convention; invoice_date carries the real
  // 2026-07-26 issue date.
  {
    entry_number: '25',
    description: 'Anthropic €18.00 — non-EU RC, EUR-billed (Claude Pro); same-day pay 2610 (invoice JQYX1OS2-0014)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'july_2026_entry_25',
      posting_date: '2026-07-28',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Anthropic invoice JQYX1OS2-0014 (issued 2026-07-26, Claude Pro Jul 26-Aug 26) €18.00 — non-EU RC (Article 44 + 196); EUR-billed, no FX; LV self-assessment 21%',
      counterparty_id: ANTHROPIC_CP_ID,
      payload: tag('25', {
        invoice_currency: 'EUR',
        invoice_net_cents: 1800,
        expense_account: '7730',
        payable_account: '2610',
        vat_treatment: 'non_eu_rc',
        vendor_invoice_number: 'JQYX1OS2-0014',
        vendor_country: 'US',
        invoice_date: '2026-07-26'
      })
    }
  },

  // 2026-07-29: KL77 cart payment (C.2 bank-link → 2620) — order still
  // `shipped`, no completion entry
  {
    entry_number: '26',
    description: 'KL77 cart €23.10 — bank-link receipt direct to 2620 (Kristina Smirnoviene); order not yet completed',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_26',
      posting_date: '2026-07-29',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260729-KL77 cart €23.10 — bank-link (PIS) to 2620 (ref st886131); order still `shipped`, completion deferred to a future backfill',
      payload: tag('26', {
        payment_method: 'bank_link',
        gross_cart_cents: 2310,
        buyer_wallet_cents: 0,
        bank_account: '2620',
        cart_payment_id: KL77_CART,
        everypay_payment_id: KL77_EVERYPAY
      })
    }
  },

  // 2026-07-30: 4DUR cart payment (C.1 card → 2630) — settlement lands 01.08
  // (August, out of scope); order still `shipped`, no completion entry.
  // Mirrors UJRJ's June precedent exactly (in-transit card receipt carries
  // to the next month).
  {
    entry_number: '27',
    description: '4DUR cart €63.10 — card receipt to 2630 clearing (settlement lands 01.08, out of scope — mirrors UJRJ precedent)',
    event: {
      event_type: 'everypay.payment_confirmed',
      source_doc_type: SOURCE_DOC_TYPE_CART_PAYMENT,
      source_doc_id: 'july_2026_entry_27',
      posting_date: '2026-07-30',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260730-4DUR cart €63.10 — card to 2630 EveryPay clearing; settlement not found in July statement (lands 01.08 as POS DAR 310726/63.10), carries in-transit to August',
      payload: tag('27', {
        payment_method: 'card',
        gross_cart_cents: 6310,
        buyer_wallet_cents: 0,
        cart_payment_id: DUR4_CART,
        everypay_payment_id: DUR4_EVERYPAY
      })
    }
  },

  // 2026-07-31: HXHB completion (O.1 LV) — Aigars
  {
    entry_number: '28',
    description: 'HXHB completion €17.10 — LV B2C',
    sellerUserId: AIGARS_USER_ID,
    event: {
      event_type: 'order.completed',
      source_doc_type: SOURCE_DOC_TYPE_ORDER,
      source_doc_id: 'july_2026_entry_28',
      posting_date: '2026-07-31',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Order STG-20260721-HXHB — LV B2C completion (item €15.00 + ship €2.10 = €17.10)',
      payload: tag('28', {
        order_id: HXHB_ID,
        order_number: 'STG-20260721-HXHB',
        invoice_number: 'INV-2026-00035',
        consumption_ms: 'LV',
        item_value_cents: 1500,
        shipping_value_cents: 210
      })
    }
  },

  // 2026-07-31: Meta ads — EU B2B RC invoice receipt (I.3). 4 card debits
  // total €19.42 (28.07 €4.42, 30.07 €5.00, 31.07 €5.00, and a 4th €5.00
  // booked 02.08 but narrative-dated 31.07 — included here since accrual
  // timing follows economic incurral, not cash-clearing date, mirroring the
  // May→June rollover precedent). All 4 invoice numbers confirmed from the
  // real Meta/FBADS invoice PDFs, matched to bank charges by transaction
  // timestamp: FBADS-046-106259359 (€4.42, txn Jul 27 06:04),
  // FBADS-046-106267577 (€5.00, txn Jul 28 22:04), FBADS-046-106273729
  // (€5.00, txn Jul 30 03:42), FBADS-046-106285148 (€5.00, txn Jul 31 23:28).
  {
    entry_number: '29',
    description: 'Meta ads €19.42 — EU B2B RC (4 card debits 28-31.07, code P); self-assess 21% RC VAT €4.08; accrued to 5310-META (FBADS-046-106259359/106267577/106273729/106285148)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_INVOICE,
      source_doc_id: 'july_2026_entry_29',
      posting_date: '2026-07-31',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Meta Platforms Ireland ads €19.42 — EU B2B RC (Article 196); 4 invoices covering card debits 27-31.07 2026 (FBADS-046-106259359, FBADS-046-106267577, FBADS-046-106273729, FBADS-046-106285148); LV self-assessment 21%',
      counterparty_id: META_CP_ID,
      payload: tag('29', {
        invoice_net_cents: 1942,
        invoice_vat_cents: 0,
        expense_account: '7750',
        vat_treatment: 'eu_b2b_rc',
        vendor_invoice_number: 'FBADS-046-106259359, FBADS-046-106267577, FBADS-046-106273729, FBADS-046-106285148',
        vendor_vat_number: 'IE9692928F',
        vendor_country: 'IE',
        invoice_date: '2026-07-31'
      })
    }
  },

  // 2026-07-31: Meta ads payment (I.7) — clears 3 of 4 card debits (€14.42):
  // FBADS-046-106259359 (€4.42) + FBADS-046-106267577 (€5.00) +
  // FBADS-046-106273729 (€5.00). The 4th (FBADS-046-106285148, €5.00,
  // cash-cleared 02.08) rolls to August's backfill, mirroring May's €6.00
  // rollover precedent exactly.
  {
    entry_number: '30',
    description: 'Meta ads payment €14.42 — 3 of 4 July invoices settled on card 28-31.07; €5.00 remains payable (settles August)',
    event: {
      event_type: 'vendor.payment_made',
      source_doc_type: SOURCE_DOC_TYPE_VENDOR_PAYMENT,
      source_doc_id: 'july_2026_entry_30',
      posting_date: '2026-07-31',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Meta ads payment €14.42 — MasterCard settlements clear 3 of 4 July invoices: FBADS-046-106259359 (€4.42) + FBADS-046-106267577 (€5.00) + FBADS-046-106273729 (€5.00); FBADS-046-106285148 (€5.00, cash-cleared 02.08) settles August',
      counterparty_id: META_CP_ID,
      payload: tag('30', {
        payment_cents: 1442,
        payable_account: '5310-META',
        vendor_invoice_number: 'FBADS-046-106259359, FBADS-046-106267577, FBADS-046-106273729',
        bank_account: '2610'
      })
    }
  },

  // 2026-07-31: Monthly account maintenance fee (I.5 exempt), 2610 account
  {
    entry_number: '31',
    description: 'Monthly account maintenance fee €5.00 — 2610 operating account',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'july_2026_entry_31',
      posting_date: '2026-07-31',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Swedbank AS monthly account maintenance fee €5.00 (Konta uzturēšanas ikmēneša maksa 2026.07) — 2610 operating account, PVN likums Article 52 exempt',
      payload: tag('31', {
        fee_cents: 500,
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // 2026-07-31: Monthly account maintenance fee (I.5 exempt), 2620 account
  {
    entry_number: '32',
    description: 'Monthly account maintenance fee €5.00 — 2620 e-commerce settlement account',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE_BANK_FEE,
      source_doc_id: 'july_2026_entry_32',
      posting_date: '2026-07-31',
      accounting_period: '2026-07',
      tax_period: '2026-07',
      narrative: 'Swedbank AS monthly account maintenance fee €5.00 (Konta uzturēšanas ikmēneša maksa 2026.07) — 2620 e-commerce settlement account, PVN likums Article 52 exempt',
      payload: tag('32', {
        fee_cents: 500,
        bank_account: '2620',
        vendor: 'swedbank',
        fee_type: 'pis_commission',
        vat_treatment: 'exempt_financial_service'
      })
    }
  }
];

export const TOTAL_BACKFILL_ENTRIES = 32;
if (BACKFILL_ENTRIES.length !== TOTAL_BACKFILL_ENTRIES) {
  throw new Error(
    `july-2026-backfill-data.ts: expected ${TOTAL_BACKFILL_ENTRIES} BACKFILL_ENTRIES, ` +
    `got ${BACKFILL_ENTRIES.length}. Update TOTAL_BACKFILL_ENTRIES + the reconcile checkpoints together.`
  );
}
