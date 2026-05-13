/**
 * V3 mapping table — TypeScript representation (PR #2).
 *
 * Maps stg-vat-mapping-table-v3.md type IDs to their routing criteria, VAT
 * base rule, posting recipe, reporting flags, and per-type compute function.
 * The dispatcher (dispatcher.ts) reads MAPPING_TABLE; the engine
 * (posting-engine.ts) calls the resolved entry's compute().
 *
 * PR #2 ships 9 of ~30 type IDs. Adding a new type later is a new entry in
 * MAPPING_TABLE plus a test — no engine code change.
 *
 * In scope this PR:
 *
 *   O.1 — LV seller commission + shipping mgmt (5-way routing: LV branch)
 *   O.2 — LT B2B reverse-charge (VIES-validated; ESL flag)
 *   O.3 — LT B2C OSS (5711 routing; no PVN line)
 *   I.1 — LV vendor with standard VAT (62 input deduction)
 *   I.4 — Non-EU vendor with FX decomposition (§F worked example)
 *   P.1 — Monthly VAT consolidation, refund position
 *   H.1 — Historical override (pre-computed amounts; bypass §F)
 *   C.4 — Wallet withdrawal (KYC gate)
 *   C.6 — Share capital contribution (smoke test)
 *
 * Two engine-noteworthy behaviours documented here:
 *
 * 1. v3 §B.3 specifies a "zero-amount placeholder line on 5710-RC-EUSALES"
 *    for O.2/O.4 reporting visibility. This violates the journal_lines CHECK
 *    `(debit_cents = 0) <> (credit_cents = 0)` (exactly one non-zero), so
 *    PR #2 produces 3-line entries for O.2/O.4 without the placeholder. ESL
 *    reporting visibility comes from vat_country='LT'/'EE' + vat_rate_snapshot=0
 *    on the revenue credit lines. v3-doc reconcile flagged in plan followups.
 *
 * 2. v3 §B.3's full O.x entry combines suspense release + Unisend accrual +
 *    wallet credit + invoice issuance into one balanced 6-line entry. PR #2
 *    ships only the COMMISSION INVOICE slice — 1 to 3 lines depending on
 *    payload:
 *      Dr 5351 commission_gross (always)
 *      Cr 6310-C commission_net (when commission_net > 0)
 *      Cr 5710-* commission_vat (when vat_account != null AND vat_vat > 0;
 *        B2B RC and tiny-amount sub-cent VAT both skip the line)
 *    The wallet (5351) carries item proceeds (credited via PR #5's suspense
 *    release) minus commission charged here. Buyer-paid SHIPPING never flows
 *    through 5351 — it lives in the suspense account until released by PR #5,
 *    at which point shipping logistics revenue (6310-S) and shipping VAT are
 *    recognized in the same lifecycle entry that releases suspense and
 *    accrues Unisend payable. This matches the seller-facing wallet promise
 *    in services/pricing.ts: walletCreditCents = itemsTotalCents − commissionCents
 *    (no shipping). All conditional pushes mirror buildVendorRcLines's
 *    `rc_vat_cents > 0` guard so journal_lines CHECK `(debit=0) <> (credit=0)`
 *    is never violated. The slice is balanced on its own.
 */

import { SELLER_COMMISSION_RATE as COMMISSION_RATE } from '@/lib/pricing/constants';

import {
  decomposeFx,
  requireNumber,
  requireString,
  roundHalfUpCents,
  splitInclusiveVat
} from './computer';
import { PostingValidationError } from './errors';
import type {
  ComputeInput,
  ComputeOutput,
  ComputedLine,
  CounterpartyRow,
  VatMappingEntry
} from './types';

// =============================================================================
// Helpers shared across compute()
// =============================================================================

/**
 * Sentinel values distinguishing historical override entries from engine-computed
 * entries in audit queries. Each variant routes to a different VatMappingEntry
 * (H.1, H.2, H.3); the discriminator is `payload.override_type`. Defined here
 * so any future rename lands in one place.
 *
 *   HISTORICAL_FILING       → H.1 — match an as-filed PVN deklarācija exactly
 *   INPUT_FORFEITED         → H.2 — input VAT not claimed on as-filed return
 *   PRE_REGISTRATION_GROSS  → H.3 — pre-VAT-reg gross expensing (with optional FX)
 */
export const OVERRIDE_TYPE_HISTORICAL_FILING = 'historical_filing_alignment';
export const OVERRIDE_TYPE_INPUT_FORFEITED = 'input_forfeited';
export const OVERRIDE_TYPE_PRE_REGISTRATION_GROSS = 'pre_registration_gross';

/** Vendor account code derivation from counterparty.vendor_code (e.g. 'UN' → '5310-UN'). */
function vendorPayableAccount(vendorCode: string): string {
  return `5310-${vendorCode}`;
}

/** Engine-invariant guard. Use whenever a routing-time precondition is unexpectedly violated. */
function engineInvariant(reason: string, context?: Record<string, unknown>): never {
  throw new PostingValidationError({
    code: 'engine_invariant',
    reason,
    context
  });
}

/**
 * Shared scaffolding for pre-computed lines (P.1, H.1, P.7). Caller passes
 * `payload.lines: Array<{ account_code, debit_cents?, credit_cents?, ... }>`;
 * the helper validates the array shape and projects each entry into a
 * ComputedLine. The optional `forwardVat` flag carries through
 * `vat_rate_snapshot` / `vat_country` (used by H.1 for VID-reportable RC
 * lines; P.1 and P.7 don't need VAT metadata on close lines).
 */
function buildPreComputedLines(
  raw_lines: unknown,
  opts: { type_id: string; defaultNarrative: string | null; forwardVat?: boolean }
): ComputedLine[] {
  if (!Array.isArray(raw_lines) || raw_lines.length < 2) {
    throw new Error(`${opts.type_id} requires payload.lines as array with >= 2 entries`);
  }
  return raw_lines.map((rawUnknown, idx) => {
    const raw = rawUnknown as Record<string, unknown>;
    const account_code = requireString(raw, 'account_code');
    const debit_cents = typeof raw.debit_cents === 'number' ? raw.debit_cents : 0;
    const credit_cents = typeof raw.credit_cents === 'number' ? raw.credit_cents : 0;
    const line: ComputedLine = {
      line_number: idx + 1,
      account_code,
      debit_cents,
      credit_cents,
      currency: 'EUR',
      narrative: typeof raw.narrative === 'string' ? raw.narrative : opts.defaultNarrative
    };
    if (opts.forwardVat) {
      line.vat_rate_snapshot = typeof raw.vat_rate_snapshot === 'number' ? raw.vat_rate_snapshot : null;
      line.vat_country = typeof raw.vat_country === 'string' ? raw.vat_country : null;
    }
    return line;
  });
}

/**
 * Shared scaffolding for outgoing order completion entries (O.1, O.2, O.3,
 * O.4, O.5). Produces the full v1.4 5-line completion entry per
 * `docs/legal_audit/accountant-completion-entry-signoff.md`:
 *
 *   1. Dr 5590         gross_cart         (release suspense from cart fulfillment)
 *   2. Cr 5351         seller_net         (= item_value − commission_gross)
 *   3. Cr 6310-C       commission_net     (commission revenue net of VAT)
 *   4. Cr 6310-S       shipping_net       (shipping-mgmt revenue net of VAT)
 *   5. Cr {vat_account} vat_amount         (commission_vat + shipping_vat) — omitted for B2B RC
 *
 * Math: Σ Dr = gross_cart = item_value + shipping_value. Σ Cr balances
 * because seller_net + commission_gross + shipping_value = gross_cart, and
 * commission_gross / shipping_value each split into net + VAT inclusively.
 *
 * For B2B RC (vat_rate=0): line 5 omitted, commission_net = commission_gross,
 * shipping_net = shipping_value. Σ Cr = (item − commission) + commission +
 * shipping = item + shipping = gross_cart. Four-line entry.
 *
 * Per accountant signoff v1.4 (12 May 2026), Unisend cost recognition is
 * deferred to monthly I.1 vendor invoice receipt (Dr 7720 + Dr 5710-LV-IN /
 * Cr 5310-UN at invoice time) — not at per-order completion. v1.3's per-order
 * Dr 7720 + Cr 5410-UN accrual is dropped.
 *
 * VAT derivation invariant (load-bearing): line_vat = gross − line_net via
 * splitInclusiveVat. NEVER computed independently as round(gross × rate / (1 + rate))
 * — the two paths can produce sub-cent disagreement that breaks Σ balance.
 *
 * Caller passes the type-specific VAT routing (account + rate + country); the
 * helper handles arithmetic, rounding, and counterparty stamping uniformly.
 */
function buildOrderRevenueLines(input: {
  counterparty: CounterpartyRow | null;
  payload: Record<string, unknown>;
  vat_country: 'LV' | 'LT' | 'EE';
  vat_rate: number | null;
  /** Account that receives the VAT credit. `null` skips the VAT line entirely (B2B reverse-charge). */
  vat_account: string | null;
  /** Free-text suffix for line narratives, e.g. "LT B2B RC" or "LT B2C OSS". */
  context_label: string;
}): {
  lines: ComputedLine[];
  commission_cents: number;
  shipping_value_cents: number;
  commission_vat_cents: number;
  shipping_vat_cents: number;
  vat_cents: number;
  seller_net_cents: number;
  gross_cart_cents: number;
} {
  if (!input.counterparty?.id) {
    engineInvariant('order revenue compute requires counterparty');
  }
  if (input.vat_rate === null) {
    engineInvariant('order revenue compute requires vat_rate');
  }

  const item_value_cents = requireNumber(input.payload, 'item_value_cents');
  const shipping_gross_cents = requireNumber(input.payload, 'shipping_value_cents', { allowZero: true });
  const commission_gross_cents = roundHalfUpCents(item_value_cents * COMMISSION_RATE);
  const gross_cart_cents = item_value_cents + shipping_gross_cents;
  const seller_net_cents = item_value_cents - commission_gross_cents;

  // Inclusive split: vat_rate=0 (B2B RC) collapses to net = gross, vat = 0.
  // VAT derivation invariant: vat = gross − net (per splitInclusiveVat).
  const commission = splitInclusiveVat(commission_gross_cents, input.vat_rate);
  const shipping = splitInclusiveVat(shipping_gross_cents, input.vat_rate);
  const total_vat_cents = commission.vat_cents + shipping.vat_cents;

  // Lines pushed conditionally to satisfy journal_lines CHECK
  // `(debit_cents = 0) <> (credit_cents = 0)` (exactly one non-zero).
  const lines: ComputedLine[] = [
    {
      line_number: 1,
      account_code: '5590',
      debit_cents: gross_cart_cents,
      credit_cents: 0,
      currency: 'EUR',
      narrative: `Suspense release on order completion (gross_cart) (${input.context_label})`
    }
  ];

  if (seller_net_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: '5351',
      debit_cents: 0,
      credit_cents: seller_net_cents,
      currency: 'EUR',
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: `Seller wallet — sale proceeds net of commission (${input.context_label})`
    });
  }

  if (commission.net_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: '6310-C',
      debit_cents: 0,
      credit_cents: commission.net_cents,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: `Commission revenue, net (${input.context_label})`
    });
  }

  if (shipping.net_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: '6310-S',
      debit_cents: 0,
      credit_cents: shipping.net_cents,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: `Shipping-mgmt revenue, net (${input.context_label})`
    });
  }

  if (input.vat_account !== null && total_vat_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: input.vat_account,
      debit_cents: 0,
      credit_cents: total_vat_cents,
      currency: 'EUR',
      vat_country: input.vat_country,
      narrative: `Output VAT (commission + shipping decomposed inclusive) (${input.context_label})`
    });
  }

  return {
    lines,
    commission_cents: commission_gross_cents,
    shipping_value_cents: shipping_gross_cents,
    commission_vat_cents: commission.vat_cents,
    shipping_vat_cents: shipping.vat_cents,
    vat_cents: total_vat_cents,
    seller_net_cents,
    gross_cart_cents
  };
}

/**
 * Shared scaffolding for incoming reverse-charge vendor invoices (I.2 LV
 * domestic RC, I.3 EU B2B RC). Produces a 4-line entry where the RC pair
 * (input + output of the same self-assessed VAT amount) cancels out:
 *
 *   1. Dr {expense_account}     invoice_net_cents
 *   2. Dr {rc_in_account}       rc_vat_cents  (omitted if rc_vat_cents=0)
 *   3. Cr {payable_account}     invoice_net_cents  (5310-{vendor_code} default; '2610' for same-day pay)
 *   4. Cr {rc_out_account}      rc_vat_cents  (omitted if rc_vat_cents=0)
 *
 * If rc_vat_cents rounds to 0 (e.g. Mollie €0.01 verification — base × 21% < 0.5¢),
 * the RC pair is omitted entirely. The journal_lines CHECK requires exactly one
 * of debit_cents/credit_cents to be non-zero, so 0¢ placeholder lines violate it.
 * Reporting visibility for the zero-RC case still works via vat_country='LV' on
 * other lines if needed; for I.3 specifically, sub-cent RC has no PVN deklarācija
 * impact regardless.
 *
 * `payable_account` defaults to `5310-{vendor_code}` (vendor payable). Callers
 * can override with `payload.payable_account` (e.g. '2610' when invoice is paid
 * same-day, as in Phase 0 Entry 14a where the C&C MacBook was invoiced and
 * paid on 20.01.2026).
 */
function buildVendorRcLines(input: {
  counterparty: CounterpartyRow;
  payload: Record<string, unknown>;
  vat_rate: number;
  vat_country: 'LV';
  rc_in_account: string;
  rc_out_account: string;
  context_label: string;
}): { lines: ComputedLine[]; invoice_net_cents: number; rc_vat_cents: number; payable_account: string } {
  if (!input.counterparty.id) {
    engineInvariant('vendor RC compute requires counterparty.id');
  }
  if (!input.counterparty.vendor_code && typeof input.payload.payable_account !== 'string') {
    engineInvariant('vendor RC compute requires counterparty.vendor_code OR payload.payable_account override');
  }

  const invoice_net_cents = requireNumber(input.payload, 'invoice_net_cents');
  const expense_account = requireString(input.payload, 'expense_account');
  const payable_account = typeof input.payload.payable_account === 'string'
    ? input.payload.payable_account
    : vendorPayableAccount(input.counterparty.vendor_code as string);
  const rc_vat_cents = roundHalfUpCents(invoice_net_cents * input.vat_rate);

  const lines: ComputedLine[] = [
    {
      line_number: 1,
      account_code: expense_account,
      debit_cents: invoice_net_cents,
      credit_cents: 0,
      currency: 'EUR',
      counterparty_type: 'vendor',
      counterparty_id: input.counterparty.id,
      narrative: `Expense (net of self-assessed RC VAT, ${input.context_label})`
    }
  ];
  if (rc_vat_cents > 0) {
    lines.push({
      line_number: 2,
      account_code: input.rc_in_account,
      debit_cents: rc_vat_cents,
      credit_cents: 0,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      narrative: `Input VAT (RC self-assessment, ${input.context_label})`
    });
  }
  lines.push({
    line_number: lines.length + 1,
    account_code: payable_account,
    debit_cents: 0,
    credit_cents: invoice_net_cents,
    currency: 'EUR',
    counterparty_type: 'vendor',
    counterparty_id: input.counterparty.id,
    narrative: payable_account.startsWith('5310-')
      ? `Vendor payable — ${input.context_label}`
      : `Bank — ${input.context_label} (paid)`
  });
  if (rc_vat_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: input.rc_out_account,
      debit_cents: 0,
      credit_cents: rc_vat_cents,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      narrative: `Output VAT (RC self-assessment, ${input.context_label})`
    });
  }

  return { lines, invoice_net_cents, rc_vat_cents, payable_account };
}

/**
 * Shared scaffolding for historical-override cash-only entries (H.2 input
 * forfeited, H.3 pre-VAT-reg gross). Both have the same posting shape — no
 * VAT split, no RC pair, just expense + cash credit. The two types differ
 * only in their `override_type` / `vat_treatment` posting_context labels.
 *
 * Payload-conditional FX branch: when `payload.fx_rate` is present (with
 * `foreign_amount` and `bank_amount_eur`), the entry splits the bank charge
 * into service value + FX fee (3 lines via decomposeFx). When FX inputs are
 * absent, falls back to gross-as-paid (2 lines via `payload.gross_cents`).
 *
 * Phase 0 callers:
 *   - H.2 with FX: Cursor (Sep 2025, Oct 2025), Vercel (Dec 2025)
 *   - H.2 without FX: Proton (Sep 2025), Inbokss (Sep 2025)
 *   - H.3 with FX: Cursor (Aug 2025, pre-reg)
 *   - H.3 without FX: VINCIT (Aug 2025), Proton (Aug 2025, EUR-billed)
 */
function buildHistoricalCashOnlyLines(input: {
  payload: Record<string, unknown>;
  override_type: string;
  vat_treatment: string;
  context_label: string;
}): { lines: ComputedLine[]; posting_context_extras: Record<string, unknown> } {
  const expense_account = requireString(input.payload, 'expense_account');
  const cash_account = typeof input.payload.cash_account === 'string'
    ? input.payload.cash_account
    : '2610';
  const has_fx = typeof input.payload.fx_rate === 'number';

  if (has_fx) {
    const foreign_amount = requireNumber(input.payload, 'foreign_amount');
    const fx_rate = requireNumber(input.payload, 'fx_rate');
    const bank_amount_eur = requireNumber(input.payload, 'bank_amount_eur');
    const fx = decomposeFx({ foreign_amount, fx_rate, bank_amount_eur });
    const bank_amount_cents = fx.service_value_eur_cents + fx.fx_fee_eur_cents;
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: expense_account,
        debit_cents: fx.service_value_eur_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: `Expense (${input.context_label}, service value EUR-equivalent)`
      },
      {
        line_number: 2,
        account_code: '7710',
        debit_cents: fx.fx_fee_eur_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: `FX fee (VAT-exempt, ${input.context_label})`
      },
      {
        line_number: 3,
        account_code: cash_account,
        debit_cents: 0,
        credit_cents: bank_amount_cents,
        currency: 'EUR',
        narrative: cash_account === '2610'
          ? `Swedbank — card transaction (${input.context_label})`
          : `${cash_account} — payment (${input.context_label})`
      }
    ];
    return {
      lines,
      posting_context_extras: {
        override_type: input.override_type,
        vat_treatment: input.vat_treatment,
        service_value_eur_cents: fx.service_value_eur_cents,
        fx_fee_eur_cents: fx.fx_fee_eur_cents,
        bank_amount_cents
      }
    };
  }

  const gross_cents = requireNumber(input.payload, 'gross_cents');
  const lines: ComputedLine[] = [
    {
      line_number: 1,
      account_code: expense_account,
      debit_cents: gross_cents,
      credit_cents: 0,
      currency: 'EUR',
      narrative: `Expense (${input.context_label})`
    },
    {
      line_number: 2,
      account_code: cash_account,
      debit_cents: 0,
      credit_cents: gross_cents,
      currency: 'EUR',
      narrative: cash_account === '2610'
        ? `Swedbank — payment (${input.context_label})`
        : `${cash_account} — payment (${input.context_label})`
    }
  ];
  return {
    lines,
    posting_context_extras: {
      override_type: input.override_type,
      vat_treatment: input.vat_treatment,
      gross_cents
    }
  };
}

// =============================================================================
// O.1 — LV seller commission + shipping mgmt
// =============================================================================

const O_1: VatMappingEntry = {
  id: 'O.1',
  category: 'outgoing',
  entry_type: 'order',
  description: 'Commission + shipping mgmt to LV seller (any tax_status)',
  legal_basis: 'PVN likums Article 27, Directive 2006/112/EC Articles 44/58 (place of supply LV→LV)',
  routing: {
    event_type: 'order.completed',
    conditions: { 'counterparty.country': 'LV' }
  },
  vat_base_rule: { source: 'item_value' },
  vat_rate_country: 'LV',
  reporting: {
    pvn_lines: ['41', '52'],
    pvn1_pielikums: 'III_dala'
  },
  posting_context_required_keys: ['order_id', 'seller_id', 'invoice_number'],
  compute: (input: ComputeInput): ComputeOutput => {
    const result = buildOrderRevenueLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_country: 'LV',
      vat_rate: input.vat_rate,
      vat_account: '5710-LV-OUT',
      context_label: 'LV B2C, 21%'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        commission_cents: result.commission_cents,
        shipping_value_cents: result.shipping_value_cents,
        commission_vat_cents: result.commission_vat_cents,
        shipping_vat_cents: result.shipping_vat_cents,
        vat_cents: result.vat_cents,
        seller_net_cents: result.seller_net_cents,
        gross_cart_cents: result.gross_cart_cents,
        vat_rate_snapshot: input.vat_rate
      }
    };
  }
};

// =============================================================================
// O.2 — LT B2B reverse-charge (VIES-validated)
// =============================================================================

const O_2: VatMappingEntry = {
  id: 'O.2',
  category: 'outgoing',
  entry_type: 'order',
  description: 'Commission + shipping mgmt to LT VAT-registered seller (B2B reverse-charge)',
  legal_basis: 'Article 196 of Directive 2006/112/EC (recipient self-assesses); Article 262 (recapitulative statement)',
  routing: {
    event_type: 'order.completed',
    conditions: {
      'counterparty.country': 'LT',
      'counterparty.tax_status': 'vat_registered',
      'counterparty.vies_verified_at': '!null'
    }
  },
  vat_base_rule: { source: 'item_value' },
  vat_rate_country: 'LT',
  reporting: {
    pvn_lines: ['48.2'],
    pvn2_esl_required: true,
    esl_transaction_code: 'S'
  },
  posting_context_required_keys: ['order_id', 'seller_id', 'seller_vat_number', 'vies_verified_at', 'invoice_number'],
  compute: (input: ComputeInput): ComputeOutput => {
    // No VAT line — recipient self-assesses LT VAT on their own return.
    // ESL visibility via vat_country='LT' + vat_rate_snapshot=0 on credit lines.
    const result = buildOrderRevenueLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_country: 'LT',
      vat_rate: 0,
      vat_account: null,
      context_label: 'LT B2B RC, 0%'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        commission_cents: result.commission_cents,
        shipping_value_cents: result.shipping_value_cents,
        commission_vat_cents: 0,
        shipping_vat_cents: 0,
        vat_cents: 0,
        seller_net_cents: result.seller_net_cents,
        gross_cart_cents: result.gross_cart_cents,
        vat_rate_snapshot: 0,
        esl_eligible: true
      }
    };
  }
};

// =============================================================================
// O.3 — LT B2C OSS (private / sole_proprietor seller)
// =============================================================================

const O_3: VatMappingEntry = {
  id: 'O.3',
  category: 'outgoing',
  entry_type: 'order',
  description: 'Commission + shipping mgmt to LT private seller (B2C OSS, Union scheme)',
  legal_basis: 'Article 58 of Directive 2006/112/EC (B2C electronically supplied services); Articles 369a–x (Union OSS scheme)',
  routing: {
    event_type: 'order.completed',
    conditions: {
      'counterparty.country': 'LT',
      'counterparty.tax_status': ['private', 'sole_proprietor']
    }
  },
  vat_base_rule: { source: 'item_value' },
  vat_rate_country: 'LT',
  reporting: {
    pvn_lines: [],
    oss_required: 'LT'
  },
  posting_context_required_keys: ['order_id', 'seller_id', 'invoice_number', 'consumption_ms'],
  compute: (input: ComputeInput): ComputeOutput => {
    const result = buildOrderRevenueLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_country: 'LT',
      vat_rate: input.vat_rate,
      vat_account: '5711',
      context_label: 'LT B2C OSS'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        commission_cents: result.commission_cents,
        shipping_value_cents: result.shipping_value_cents,
        commission_vat_cents: result.commission_vat_cents,
        shipping_vat_cents: result.shipping_vat_cents,
        vat_cents: result.vat_cents,
        seller_net_cents: result.seller_net_cents,
        gross_cart_cents: result.gross_cart_cents,
        vat_rate_snapshot: input.vat_rate,
        oss_consumption_ms: 'LT'
      }
    };
  }
};

// =============================================================================
// O.4 — EE B2B reverse-charge (VIES-validated)
// =============================================================================

const O_4: VatMappingEntry = {
  id: 'O.4',
  category: 'outgoing',
  entry_type: 'order',
  description: 'Commission + shipping mgmt to EE VAT-registered seller (B2B reverse-charge)',
  legal_basis: 'Article 196 of Directive 2006/112/EC (recipient self-assesses); Article 262 (recapitulative statement)',
  routing: {
    event_type: 'order.completed',
    conditions: {
      'counterparty.country': 'EE',
      'counterparty.tax_status': 'vat_registered',
      'counterparty.vies_verified_at': '!null'
    }
  },
  vat_base_rule: { source: 'item_value' },
  vat_rate_country: 'EE',
  reporting: {
    pvn_lines: ['48.2'],
    pvn2_esl_required: true,
    esl_transaction_code: 'S'
  },
  posting_context_required_keys: ['order_id', 'seller_id', 'seller_vat_number', 'vies_verified_at', 'invoice_number'],
  compute: (input: ComputeInput): ComputeOutput => {
    // No VAT line — recipient self-assesses EE VAT on their own return.
    // ESL visibility via vat_country='EE' + vat_rate_snapshot=0 on credit lines.
    const result = buildOrderRevenueLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_country: 'EE',
      vat_rate: 0,
      vat_account: null,
      context_label: 'EE B2B RC, 0%'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        commission_cents: result.commission_cents,
        shipping_value_cents: result.shipping_value_cents,
        commission_vat_cents: 0,
        shipping_vat_cents: 0,
        vat_cents: 0,
        seller_net_cents: result.seller_net_cents,
        gross_cart_cents: result.gross_cart_cents,
        vat_rate_snapshot: 0,
        esl_eligible: true
      }
    };
  }
};

// =============================================================================
// O.5 — EE B2C OSS (private / sole_proprietor seller)
// =============================================================================

const O_5: VatMappingEntry = {
  id: 'O.5',
  category: 'outgoing',
  entry_type: 'order',
  description: 'Commission + shipping mgmt to EE private seller (B2C OSS, Union scheme)',
  legal_basis: 'Article 58 of Directive 2006/112/EC (B2C electronically supplied services); Articles 369a–x (Union OSS scheme)',
  routing: {
    event_type: 'order.completed',
    conditions: {
      'counterparty.country': 'EE',
      'counterparty.tax_status': ['private', 'sole_proprietor']
    }
  },
  vat_base_rule: { source: 'item_value' },
  vat_rate_country: 'EE',
  reporting: {
    pvn_lines: [],
    oss_required: 'EE'
  },
  posting_context_required_keys: ['order_id', 'seller_id', 'invoice_number', 'consumption_ms'],
  compute: (input: ComputeInput): ComputeOutput => {
    const result = buildOrderRevenueLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_country: 'EE',
      vat_rate: input.vat_rate,
      vat_account: '5712',
      context_label: 'EE B2C OSS'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        commission_cents: result.commission_cents,
        shipping_value_cents: result.shipping_value_cents,
        commission_vat_cents: result.commission_vat_cents,
        shipping_vat_cents: result.shipping_vat_cents,
        vat_cents: result.vat_cents,
        seller_net_cents: result.seller_net_cents,
        gross_cart_cents: result.gross_cart_cents,
        vat_rate_snapshot: input.vat_rate,
        oss_consumption_ms: 'EE'
      }
    };
  }
};

// =============================================================================
// O.7 — Outbound credit note, current-period refund
//
// Trigger: order.refunded AND payload.tax_period_alignment='current'.
// Routing mirrors the original O.1–O.5; reverses the original posting in
// full or in part, nets in the same period. PVN deklarācija nets in the
// same line(s) as the original; ESL/OSS reversal flows to the next return.
//
// Pre-computed-lines compute() — caller (order_refund_with_gl) reads the
// original O.x entry and produces the reversal lines via payload.lines.
// =============================================================================

const O_7: VatMappingEntry = {
  id: 'O.7',
  category: 'outgoing',
  entry_type: 'refund',
  description: 'Outbound credit note, current-period refund (mirrors original O.1–O.5)',
  legal_basis: 'Articles 73, 90 of Directive 2006/112/EC (taxable amount adjustments); PVN likums credit-note rules',
  routing: {
    event_type: 'order.refunded',
    conditions: { 'payload.tax_period_alignment': 'current' }
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['order_id', 'original_invoice_number', 'credit_note_number', 'lines'],
  compute: (input: ComputeInput): ComputeOutput => {
    const lines = buildPreComputedLines(input.payload.lines, {
      type_id: 'O.7',
      defaultNarrative: 'Credit note line — current-period refund',
      forwardVat: true
    });
    return { lines, posting_context_extras: {} };
  }
};

// =============================================================================
// O.8 — Outbound credit note, cross-period refund
//
// Trigger: order.refunded AND payload.tax_period_alignment='prior'.
// Special handling: current accounting_period and tax_period; references
// original via posting_context.original_invoice_id. PVN deklarācija line 57
// (decrease of previously declared VAT) for LV-routed originals; OSS-routed
// (LT/EE) originals refunded after their original quarter route to the
// current OSS quarterly return with original_period reference (Article 61(2)
// of Implementing Regulation 282/2011 — three-year correction window).
//
// Same compute pattern as O.7 — caller pre-computes reversal lines based on
// the original O.x entry.
// =============================================================================

const O_8: VatMappingEntry = {
  id: 'O.8',
  category: 'outgoing',
  entry_type: 'refund',
  description: 'Outbound credit note, cross-period refund (PVN line 57 / OSS correction window)',
  legal_basis: 'Articles 73, 90 of Directive 2006/112/EC; Article 61(2) of Implementing Regulation 282/2011 (three-year OSS correction window)',
  routing: {
    event_type: 'order.refunded',
    conditions: { 'payload.tax_period_alignment': 'prior' }
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: ['57'] },
  posting_context_required_keys: ['order_id', 'original_invoice_number', 'original_invoice_id', 'original_period', 'credit_note_number', 'lines'],
  compute: (input: ComputeInput): ComputeOutput => {
    const lines = buildPreComputedLines(input.payload.lines, {
      type_id: 'O.8',
      defaultNarrative: 'Credit note line — cross-period refund',
      forwardVat: true
    });
    return { lines, posting_context_extras: {} };
  }
};

// =============================================================================
// O.9 — Outbound credit note, partial refund with proportional split
//
// Trigger: order.partial_refunded.
// Computes the proportional reversal of commission and shipping-mgmt revenue
// (and their VAT) when the buyer is partially refunded. Posts the same shape
// as O.7 / O.8 but with caller-supplied original totals + refund amounts —
// engine derives the proportional gross splits, then VAT-inclusive
// decomposes net + VAT per accountant-signoff v1.2.
//
// Math (per docs/legal_audit/accountant-completion-entry-signoff.md):
//   partial_commission_gross = round_half_up(original_commission_gross × refund_item / original_item)
//   partial_commission_net   = round_half_up(partial_commission_gross / (1 + vat_rate))
//   partial_commission_vat   = partial_commission_gross − partial_commission_net
//   (same shape for shipping if refund_shipping > 0)
//   total_vat                = partial_commission_vat + partial_shipping_vat
//   total_seller_credit      = partial_commission_gross + partial_shipping_gross
//
// Lines (always at least 2, balanced):
//   Dr 6310-C partial_commission_net (omitted when 0 — typically gross=0 only)
//   Dr 6310-S partial_shipping_net   (omitted when shipping not refunded)
//   Dr {vat_account} total_vat       (omitted for B2B RC vat_account=null or sub-cent)
//   Cr 5351 total_seller_credit      (always present — wallet sees gross refund)
//
// Period routing (current vs prior): caller decides; O.9 emits the lines,
// the engine assigns accounting_period and tax_period from the PostingEvent.
// The dispatcher routes O.9 by event_type='order.partial_refunded'
// regardless of period.
// =============================================================================

const O_9: VatMappingEntry = {
  id: 'O.9',
  category: 'outgoing',
  entry_type: 'refund',
  description: 'Outbound credit note, partial refund (proportional split of commission and shipping with VAT-inclusive decomposition)',
  legal_basis: 'Articles 73, 90 of Directive 2006/112/EC; PVN likums credit-note rules; accountant signoff v1.2 (10 May 2026)',
  routing: {
    event_type: 'order.partial_refunded',
    conditions: {}
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: [
    'order_id', 'original_invoice_number', 'credit_note_number',
    'original_item_value_cents', 'original_commission_gross_cents', 'original_shipping_value_cents',
    'refund_item_cents', 'refund_shipping_cents', 'vat_rate', 'vat_country'
  ],
  compute: (input: ComputeInput): ComputeOutput => {
    if (!input.counterparty?.id) {
      engineInvariant('O.9 compute requires counterparty');
    }

    const original_item_value_cents = requireNumber(input.payload, 'original_item_value_cents');
    const original_commission_gross_cents = requireNumber(input.payload, 'original_commission_gross_cents', { allowZero: true });
    const original_shipping_value_cents = requireNumber(input.payload, 'original_shipping_value_cents', { allowZero: true });
    const refund_item_cents = requireNumber(input.payload, 'refund_item_cents', { allowZero: true });
    const refund_shipping_cents = requireNumber(input.payload, 'refund_shipping_cents', { allowZero: true });
    const vat_rate = requireNumber(input.payload, 'vat_rate', { allowZero: true });
    const vat_country = requireString(input.payload, 'vat_country');
    const vat_account = typeof input.payload.vat_account === 'string' ? input.payload.vat_account : null;

    if (refund_item_cents > original_item_value_cents) {
      throw new PostingValidationError({
        code: 'invalid_payload_value',
        reason: `O.9 refund_item_cents (${refund_item_cents}) cannot exceed original_item_value_cents (${original_item_value_cents})`,
        context: { refund_item_cents, original_item_value_cents }
      });
    }
    if (refund_shipping_cents > original_shipping_value_cents) {
      throw new PostingValidationError({
        code: 'invalid_payload_value',
        reason: `O.9 refund_shipping_cents (${refund_shipping_cents}) cannot exceed original_shipping_value_cents (${original_shipping_value_cents})`,
        context: { refund_shipping_cents, original_shipping_value_cents }
      });
    }

    // Commission scales by refund_item / original_item ratio because commission
    // is a derived 10% of item_value. Shipping is buyer-paid pass-through (no
    // platform margin), so partial shipping refund maps 1:1 to refund_shipping.
    const partial_commission_gross_cents = original_item_value_cents > 0
      ? roundHalfUpCents(original_commission_gross_cents * (refund_item_cents / original_item_value_cents))
      : 0;
    const partial_shipping_gross_cents = refund_shipping_cents;

    // VAT-inclusive decomposition per accountant-signoff v1.2.
    const partial_commission = splitInclusiveVat(partial_commission_gross_cents, vat_rate);
    const partial_shipping = splitInclusiveVat(partial_shipping_gross_cents, vat_rate);

    const total_vat_cents = partial_commission.vat_cents + partial_shipping.vat_cents;
    const total_seller_credit_cents = partial_commission_gross_cents + partial_shipping_gross_cents;

    if (total_seller_credit_cents === 0) {
      throw new PostingValidationError({
        code: 'invalid_payload_value',
        reason: 'O.9 partial refund computes to zero — no journal lines to emit (refund amount too small to cover proportional commission/shipping)',
        context: { refund_item_cents, refund_shipping_cents, original_commission_gross_cents, original_shipping_value_cents }
      });
    }

    const lines: ComputedLine[] = [];

    if (partial_commission.net_cents > 0) {
      lines.push({
        line_number: lines.length + 1,
        account_code: '6310-C',
        debit_cents: partial_commission.net_cents,
        credit_cents: 0,
        currency: 'EUR',
        vat_rate_snapshot: vat_rate,
        vat_country: vat_country,
        counterparty_type: 'seller',
        counterparty_id: input.counterparty.id,
        narrative: 'Partial reversal of commission revenue (O.9)'
      });
    }

    if (partial_shipping.net_cents > 0) {
      lines.push({
        line_number: lines.length + 1,
        account_code: '6310-S',
        debit_cents: partial_shipping.net_cents,
        credit_cents: 0,
        currency: 'EUR',
        vat_rate_snapshot: vat_rate,
        vat_country: vat_country,
        counterparty_type: 'seller',
        counterparty_id: input.counterparty.id,
        narrative: 'Partial reversal of shipping-mgmt revenue (O.9)'
      });
    }

    if (vat_account !== null && total_vat_cents > 0) {
      lines.push({
        line_number: lines.length + 1,
        account_code: vat_account,
        debit_cents: total_vat_cents,
        credit_cents: 0,
        currency: 'EUR',
        vat_country: vat_country,
        narrative: 'Partial reversal of output VAT (O.9)'
      });
    }

    lines.push({
      line_number: lines.length + 1,
      account_code: '5351',
      debit_cents: 0,
      credit_cents: total_seller_credit_cents,
      currency: 'EUR',
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: 'Seller wallet — partial refund of commission/shipping (O.9)'
    });

    return {
      lines,
      posting_context_extras: {
        partial_commission_gross_cents,
        partial_commission_net_cents: partial_commission.net_cents,
        partial_commission_vat_cents: partial_commission.vat_cents,
        partial_shipping_gross_cents,
        partial_shipping_net_cents: partial_shipping.net_cents,
        partial_shipping_vat_cents: partial_shipping.vat_cents,
        total_vat_cents,
        total_seller_credit_cents,
        /**
         * Per-entry refund total (refund_item_cents + refund_shipping_cents).
         * For cumulative refund across all O.9 entries on an order, SUM across
         * entries. Surfaced as a top-level posting_context key so consumers
         * (e.g. PR D's `getInFlightCartReceiptsTotal`) can read one canonical
         * field rather than re-deriving the sum from item/shipping splits.
         */
        refund_cents: refund_item_cents + refund_shipping_cents
      }
    };
  }
};

// =============================================================================
// I.1 — LV vendor with standard VAT
// =============================================================================

const I_1: VatMappingEntry = {
  id: 'I.1',
  category: 'incoming',
  entry_type: 'manual',
  description: 'LV vendor invoice with standard 21% VAT (e.g. Unisend, VINCIT)',
  legal_basis: 'PVN likums (input VAT deduction); Article 168 of Directive 2006/112/EC',
  routing: {
    event_type: 'vendor.invoice_received',
    conditions: {
      'counterparty.country': 'LV',
      'payload.vat_treatment': 'standard'
    }
  },
  vat_base_rule: { source: 'invoice_net' },
  vat_rate_country: 'LV',
  reporting: {
    pvn_lines: ['62'],
    pvn1_pielikums: 'I_dala'
  },
  posting_context_required_keys: ['vendor_invoice_number', 'vendor_vat_number', 'invoice_date', 'expense_account', 'vat_treatment'],
  compute: (input: ComputeInput): ComputeOutput => {
    const invoice_net_cents = requireNumber(input.payload, 'invoice_net_cents');
    const invoice_vat_cents = requireNumber(input.payload, 'invoice_vat_cents', { allowZero: true });
    const expense_account = requireString(input.payload, 'expense_account');
    if (input.vat_rate === null) {
      engineInvariant('I.1 compute requires vat_rate');
    }
    // payable_account defaults to vendor payable (5310-{vendor_code}); caller
    // can override (e.g. '2610' for same-day pay, as in Phase 0 Entry 14b
    // where the C&C data carrier levy was invoiced and paid 20.01.2026).
    // When override is absent, vendor_code is required.
    const payable_override = typeof input.payload.payable_account === 'string'
      ? input.payload.payable_account
      : null;
    if (!payable_override && !input.counterparty?.vendor_code) {
      engineInvariant('I.1 compute requires counterparty.vendor_code OR payload.payable_account override');
    }
    if (!input.counterparty?.id) {
      engineInvariant('I.1 compute requires counterparty.id');
    }
    const invoice_gross_cents = invoice_net_cents + invoice_vat_cents;
    const payable_account = payable_override ?? vendorPayableAccount(input.counterparty.vendor_code as string);

    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: expense_account,
        debit_cents: invoice_net_cents,
        credit_cents: 0,
        currency: 'EUR',
        counterparty_type: 'vendor',
        counterparty_id: input.counterparty.id,
        narrative: 'Expense (net of VAT)'
      },
      {
        line_number: 2,
        account_code: '5710-LV-IN',
        debit_cents: invoice_vat_cents,
        credit_cents: 0,
        currency: 'EUR',
        vat_rate_snapshot: input.vat_rate,
        vat_country: 'LV',
        narrative: 'Input VAT (priekšnodoklis)'
      },
      {
        line_number: 3,
        account_code: payable_account,
        debit_cents: 0,
        credit_cents: invoice_gross_cents,
        currency: 'EUR',
        counterparty_type: 'vendor',
        counterparty_id: input.counterparty.id,
        narrative: payable_account.startsWith('5310-') ? 'Vendor payable (gross)' : 'Bank (gross, paid)'
      }
    ];
    return {
      lines,
      posting_context_extras: {
        invoice_net_cents,
        invoice_vat_cents,
        invoice_gross_cents,
        vat_rate_snapshot: input.vat_rate,
        payable_account
      }
    };
  }
};

// =============================================================================
// I.2 — LV vendor with domestic reverse charge
//
// Used for PVN likums Article 143.7 categories: laptops, mobile phones, tablets,
// integrated circuit devices, gaming consoles, construction services, scrap
// metal, certain agricultural products. Vendor invoices at 0%; STG self-
// assesses 21% LV VAT via the RC-IN/RC-OUT pair (cancels out, net cash VAT=0).
//
// I.6 capitalization is a payload convention, not a separate type ID: when the
// underlying asset is capitalized, caller passes `expense_account: '1230'`
// (or a sub-account) instead of an expense account. compute() doesn't care
// about the account semantics.
// =============================================================================

const I_2: VatMappingEntry = {
  id: 'I.2',
  category: 'incoming',
  entry_type: 'manual',
  description: 'LV vendor invoice with domestic reverse charge (PVN likums Article 143.7)',
  legal_basis: 'PVN likums Article 143.7 (domestic RC for specified categories)',
  routing: {
    event_type: 'vendor.invoice_received',
    conditions: {
      'counterparty.country': 'LV',
      'payload.vat_treatment': 'domestic_rc'
    }
  },
  vat_base_rule: { source: 'invoice_net' },
  vat_rate_country: 'LV',
  reporting: {
    // PVN deklarācija lines per the actual January 2026 filing (C&C MacBook):
    // 52 (output, self-assessed standard rate); 62 (input deduction). PVN 1
    // daļa I attachment with transaction code 'R4' (PVN-1-I code, not ESL —
    // ESL is for outbound supplies only, and I.2 is incoming domestic).
    pvn_lines: ['52', '62'],
    pvn1_pielikums: 'I_dala'
  },
  posting_context_required_keys: ['vendor_invoice_number', 'vendor_vat_number', 'invoice_date', 'expense_account', 'vat_treatment'],
  compute: (input: ComputeInput): ComputeOutput => {
    if (input.vat_rate === null) {
      engineInvariant('I.2 compute requires vat_rate');
    }
    if (!input.counterparty) {
      engineInvariant('I.2 compute requires counterparty');
    }
    const result = buildVendorRcLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_rate: input.vat_rate,
      vat_country: 'LV',
      rc_in_account: '5710-LV-RC-IN',
      rc_out_account: '5710-LV-RC-OUT',
      context_label: 'LV domestic RC'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        invoice_net_cents: result.invoice_net_cents,
        rc_vat_cents: result.rc_vat_cents,
        vat_rate_snapshot: input.vat_rate,
        payable_account: result.payable_account
      }
    };
  }
};

// =============================================================================
// I.3 — EU B2B vendor with reverse charge
//
// Used for B2B services received from VAT-registered vendors in EU member states
// (other than LV). Place of supply per Article 44 of Directive 2006/112/EC = LV
// (customer's country); STG self-assesses 21% LV VAT. RC-IN/RC-OUT pair
// cancels out, net cash VAT=0.
//
// Phase 0 example: Mollie €0.01 verification (NL). Sub-cent RC VAT rounds to 0
// and the RC pair is omitted (helper handles this — see buildVendorRcLines).
// =============================================================================

const EU_MS_COUNTRIES = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','MT','NL','PL','PT','RO','SE','SI','SK'] as const;

const I_3: VatMappingEntry = {
  id: 'I.3',
  category: 'incoming',
  entry_type: 'manual',
  description: 'EU B2B vendor invoice with foreign reverse charge (Hetzner DE, Mollie NL, Maksekeskus EE)',
  legal_basis: 'Article 44 + Article 196 of Directive 2006/112/EC; PVN likums Article 88(1)',
  routing: {
    event_type: 'vendor.invoice_received',
    conditions: {
      'counterparty.country': EU_MS_COUNTRIES,
      'payload.vat_treatment': 'eu_b2b_rc'
    }
  },
  vat_base_rule: { source: 'invoice_net' },
  vat_rate_country: 'LV',
  reporting: {
    pvn_lines: ['55', '64'],
    pvn1_pielikums: 'II_dala'
  },
  posting_context_required_keys: ['vendor_invoice_number', 'vendor_vat_number', 'vendor_country', 'invoice_date', 'expense_account', 'vat_treatment'],
  compute: (input: ComputeInput): ComputeOutput => {
    if (input.vat_rate === null) {
      engineInvariant('I.3 compute requires vat_rate');
    }
    if (!input.counterparty) {
      engineInvariant('I.3 compute requires counterparty');
    }
    const result = buildVendorRcLines({
      counterparty: input.counterparty,
      payload: input.payload,
      vat_rate: input.vat_rate,
      vat_country: 'LV',
      rc_in_account: '5710-RC-IN',
      rc_out_account: '5710-RC-OUT',
      context_label: 'EU B2B RC'
    });
    return {
      lines: result.lines,
      posting_context_extras: {
        invoice_net_cents: result.invoice_net_cents,
        rc_vat_cents: result.rc_vat_cents,
        vat_rate_snapshot: input.vat_rate,
        payable_account: result.payable_account
      }
    };
  }
};

// =============================================================================
// I.5 — VAT-exempt domestic financial service (bank fees)
//
// PIS commissions, POS terminal fees, foreign-payment commissions, FX
// conversion fees from Swedbank. PVN likums Article 52 / Article 135(1)(d)
// of Directive 2006/112/EC — exempt financial services. No VAT split, no PVN
// deklarācija line.
//
// Posts as 2-line: Dr 7710 / Cr 2610. Counterparty optional (bank fees don't
// have a vendor invoice; the fee_type discriminator in payload identifies
// the service).
// =============================================================================

const I_5: VatMappingEntry = {
  id: 'I.5',
  category: 'incoming',
  entry_type: 'manual',
  description: 'VAT-exempt domestic financial service (Swedbank PIS/POS/foreign-payment/FX commissions)',
  legal_basis: 'PVN likums Article 52; Article 135(1)(d) of Directive 2006/112/EC',
  routing: {
    event_type: 'bank.fee_charged',
    conditions: {
      'payload.fee_type': ['pis_commission', 'pos_terminal', 'foreign_payment', 'fx_conversion']
    }
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['vendor', 'fee_type'],
  compute: (input: ComputeInput): ComputeOutput => {
    const fee_cents = requireNumber(input.payload, 'fee_cents');
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '7710',
        debit_cents: fee_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Payment processing — bank fee (VAT-exempt)'
      },
      {
        line_number: 2,
        account_code: '2610',
        debit_cents: 0,
        credit_cents: fee_cents,
        currency: 'EUR',
        narrative: 'Swedbank — fee debit'
      }
    ];
    return { lines, posting_context_extras: { fee_cents, vat_treatment: 'exempt_financial_service' } };
  }
};

// =============================================================================
// I.7 — Vendor payment settlement (cash leg of two-entry vendor invoice pattern)
//
// Trigger: vendor.payment_made. Settles a vendor AP row created by I.1 / I.2 /
// I.3 / I.4. No VAT impact — VAT was recognized (input deduction or RC self-
// assessment) at invoice receipt; this is pure cash settlement.
//
// Convention (April 2026 backfill onward): every vendor invoice posts as two
// entries — receipt (I.1/I.2/I.3/I.4 with payable_account defaulted to
// 5310-{vendor_code}) plus a separate I.7 payment. Phase 0's same-day-pay
// collapse (passing payable_account='2610' to I.1/I.2 to merge invoice + payment
// into one entry) remains supported for back-compat; new flows should prefer
// the two-entry shape so the AP sub-ledger reflects unpaid liabilities at any
// point in time. PR #4b's vendor-invoice intake architecture is designed
// against this two-entry shape.
//
// Required payload keys: vendor_invoice_number (cross-reference to the invoice
// this settles), payable_account (the 5310-XX AP being cleared). Optional:
// bank_account (defaults to '2610' Swedbank operating).
// =============================================================================

const I_7: VatMappingEntry = {
  id: 'I.7',
  category: 'incoming',
  entry_type: 'vendor_payment',
  description: 'Vendor payment settlement — debits AP, credits bank (cash leg of two-entry invoice flow)',
  legal_basis: 'Settlement of liability recognised at I.1/I.2/I.3/I.4; no VAT impact',
  routing: {
    event_type: 'vendor.payment_made',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['vendor_invoice_number', 'payable_account'],
  compute: (input: ComputeInput): ComputeOutput => {
    const payment_cents = requireNumber(input.payload, 'payment_cents');
    const payable_account = requireString(input.payload, 'payable_account');
    const vendor_invoice_number = requireString(input.payload, 'vendor_invoice_number');
    const bank_account = typeof input.payload.bank_account === 'string'
      ? input.payload.bank_account
      : '2610';
    if (!input.counterparty?.id) {
      engineInvariant('I.7 compute requires counterparty');
    }
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: payable_account,
        debit_cents: payment_cents,
        credit_cents: 0,
        currency: 'EUR',
        counterparty_type: 'vendor',
        counterparty_id: input.counterparty.id,
        narrative: `Vendor payable settled — invoice ${vendor_invoice_number}`
      },
      {
        line_number: 2,
        account_code: bank_account,
        debit_cents: 0,
        credit_cents: payment_cents,
        currency: 'EUR',
        narrative: bank_account === '2610'
          ? 'Swedbank — outbound vendor payment'
          : 'Bank — outbound vendor payment'
      }
    ];
    return {
      lines,
      posting_context_extras: { payment_cents, payable_account, bank_account }
    };
  }
};

// =============================================================================
// I.4 — Non-EU vendor B2B reverse-charge with FX decomposition (§F)
// =============================================================================

const I_4: VatMappingEntry = {
  id: 'I.4',
  category: 'incoming',
  entry_type: 'manual',
  description: 'Non-EU vendor B2B reverse-charge with FX (Anthropic, Cursor, Vercel, Proton)',
  legal_basis: 'Article 44 + Article 196 of Directive 2006/112/EC; PVN likums Article 88.4',
  routing: {
    event_type: 'vendor.invoice_received',
    conditions: {
      'counterparty.country': ['US', 'CH', 'GB'],
      'payload.vat_treatment': 'non_eu_rc'
    }
  },
  vat_base_rule: { source: 'service_value_fx' },
  vat_rate_country: 'LV',
  reporting: {
    // PVN deklarācija lines 54 (output, RC self-assessment for non-EU service)
    // and 63 (input deduction). PVN 1 daļa I attachment with transaction code
    // 'N' (non-EU received-services PVN-1-I marker, not an ESL code — ESL is
    // for outbound supplies only, and I.4 is incoming). Pattern matches I.2's
    // domestic-RC handling cleaned up in PR #281: drop the `esl_transaction_code`
    // field on incoming types entirely; the PVN-1-I 'N' marker can be carried
    // separately if reporting needs it.
    pvn_lines: ['54', '63'],
    pvn1_pielikums: 'I_dala'
  },
  posting_context_required_keys: [
    'vendor_invoice_number',
    'vendor_country',
    'invoice_currency',
    'fx_rate',
    'fx_rate_source',
    'bank_amount_eur',
    'usd_amount',
    'expense_account',
    'vat_treatment'
  ],
  compute: (input: ComputeInput): ComputeOutput => {
    const usd_amount = requireNumber(input.payload, 'usd_amount');
    const fx_rate = requireNumber(input.payload, 'fx_rate');
    const bank_amount_eur = requireNumber(input.payload, 'bank_amount_eur');
    const expense_account = requireString(input.payload, 'expense_account');
    if (input.vat_rate === null) {
      engineInvariant('I.4 compute requires vat_rate');
    }
    const fx = decomposeFx({ foreign_amount: usd_amount, fx_rate, bank_amount_eur });
    const rc_vat_cents = roundHalfUpCents(fx.service_value_eur_cents * input.vat_rate);
    const bank_amount_cents = fx.service_value_eur_cents + fx.fx_fee_eur_cents;

    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: expense_account,
        debit_cents: fx.service_value_eur_cents,
        credit_cents: 0,
        currency: 'EUR',
        counterparty_type: input.counterparty ? 'vendor' : null,
        counterparty_id: input.counterparty?.id ?? null,
        narrative: 'Expense (service value, EUR-equivalent)'
      },
      {
        line_number: 2,
        account_code: '7710',
        debit_cents: fx.fx_fee_eur_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'FX fee (VAT-exempt financial service)'
      },
      {
        line_number: 3,
        account_code: '5710-RC-IN',
        debit_cents: rc_vat_cents,
        credit_cents: 0,
        currency: 'EUR',
        vat_rate_snapshot: input.vat_rate,
        vat_country: 'LV',
        narrative: 'Input VAT (RC self-assessment, deductible)'
      },
      {
        line_number: 4,
        account_code: '2610',
        debit_cents: 0,
        credit_cents: bank_amount_cents,
        currency: 'EUR',
        narrative: 'Swedbank — card transaction (gross EUR billed)'
      },
      {
        line_number: 5,
        account_code: '5710-RC-OUT',
        debit_cents: 0,
        credit_cents: rc_vat_cents,
        currency: 'EUR',
        vat_rate_snapshot: input.vat_rate,
        vat_country: 'LV',
        narrative: 'Output VAT (RC self-assessment)'
      }
    ];
    return {
      lines,
      posting_context_extras: {
        service_value_eur_cents: fx.service_value_eur_cents,
        fx_fee_eur_cents: fx.fx_fee_eur_cents,
        rc_vat_cents,
        bank_amount_cents,
        vat_rate_snapshot: input.vat_rate
      }
    };
  }
};

// =============================================================================
// P.1 — Monthly VAT consolidation (refund OR payable position)
//
// Caller pre-computes the close: which 5710-* sub-accounts to clear and the
// resulting net direction (refund vs payable). Engine emits the lines verbatim.
// This shape matches v3 §D's P.1 spec: no engine-side VAT computation; the
// consolidation is the closing arithmetic done by accounting workflow.
//
// Routing event_type was `period_close.monthly_refund` pre-PR-C-commit-12;
// renamed to `period_close.monthly_vat` (direction-agnostic) when the
// monthly-vat-close cron landed in commit 12 to support both refund and
// payable position emissions. April backfill's `close_2026_04` entry was
// posted with the legacy event_type; that historical record is unchanged
// (event_type is NOT persisted to journal_entries — only type_id='P.1' is).
//
// payload.lines: array of { account_code, debit_cents?, credit_cents? }
//   Refund: Dr 5710-LV-OUT + Dr 2380 + Cr 5710-LV-IN
//   Payable: Dr 5710-LV-OUT + Cr 5710-LV-IN + Cr 5710-09 (PVN klīringa konts)
//   Zero-net (both sides nonzero but equal): Dr 5710-LV-OUT + Cr 5710-LV-IN
// payload.closing_period: 'YYYY-MM' (audit metadata)
// payload.net_refund_cents: legacy key (positive = refund, negative = payable);
//   preserved post-rename so historical and future entries share the same
//   queryable shape. Q12-7a (commit 12): kept rather than renamed.
// payload.net_payable_to_vid_cents: sibling representation (positive = payable,
//   negative = refund). Added in commit 12 for direction-explicit queries.
// =============================================================================

const P_1: VatMappingEntry = {
  id: 'P.1',
  category: 'period_close',
  entry_type: 'period_close',
  description: 'Monthly VAT consolidation (refund or payable position)',
  legal_basis: 'PVN likums (period close); Cabinet Regulation 877',
  routing: {
    event_type: 'period_close.monthly_vat',
    conditions: {}
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: ['70'] },
  posting_context_required_keys: ['closing_period', 'net_refund_cents', 'lines'],
  compute: (input: ComputeInput): ComputeOutput => ({
    lines: buildPreComputedLines(input.payload.lines, { type_id: 'P.1', defaultNarrative: null }),
    posting_context_extras: {}
  })
};

// =============================================================================
// H.1 — Historical override (filing alignment)
//
// Same shape as P.1: caller passes pre-computed lines; engine bypasses §F.
// posting_context.override_type='historical_filing_alignment' is added so any
// later audit query can distinguish historical overrides from engine-computed
// entries.
// =============================================================================

const H_1: VatMappingEntry = {
  id: 'H.1',
  category: 'historical',
  entry_type: 'manual',
  description: 'Historical override — match an as-filed PVN deklarācija exactly',
  legal_basis: 'Phase 0 backfill alignment to closed filings; user decision documented in posting_context.rationale',
  routing: {
    event_type: 'historical.override',
    conditions: { 'payload.override_type': OVERRIDE_TYPE_HISTORICAL_FILING }
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['rc_override_reason', 'rc_base_filed', 'filing_ref', 'rationale', 'override_type', 'lines'],
  compute: (input: ComputeInput): ComputeOutput => ({
    lines: buildPreComputedLines(input.payload.lines, {
      type_id: 'H.1',
      defaultNarrative: 'Historical override line',
      forwardVat: true
    }),
    posting_context_extras: { override_type: OVERRIDE_TYPE_HISTORICAL_FILING }
  })
};

// =============================================================================
// H.2 — Historical override: post-VAT-reg input forfeited (FX-aware)
//
// Used for transactions that occurred AFTER STG's VAT registration date but
// where input VAT was NOT claimed on the as-filed PVN deklarācija. The
// transaction is expensed without an RC self-assessment pair to match the
// as-filed return; the December 2025 H.1 catch-up consolidates RC for
// October Cursor + December Vercel separately.
//
// FX-aware: payload presence of `fx_rate` triggers the 3-line FX shape
// (Dr expense_account service_value / Dr 7710 fx_fee / Cr 2610 bank_amount).
// Without FX inputs, falls back to 2-line gross-as-paid via `gross_cents`.
//
// Phase 0 callers:
//   - Entry 7 (Cursor Sep 2025, FX): Dr 7730 €17.23 / Dr 7710 €0.51 / Cr 2610 €17.74
//   - Entry 8 (Proton Sep 2025, no FX): Dr 7730 €7.99 / Cr 2610 €7.99
//   - Entry 9 (Inbokss Sep 2025, no FX): Dr 7730 €9.99 / Cr 2610 €9.99
//   - Entry 10 (Cursor Oct 2025, FX): Dr 7730 €17.12 / Dr 7710 €0.51 / Cr 2610 €17.63
//   - Entry 11 (Vercel Dec 2025, FX): Dr 7730 €17.04 / Dr 7710 €0.50 / Cr 2610 €17.54
// =============================================================================

const H_2: VatMappingEntry = {
  id: 'H.2',
  category: 'historical',
  entry_type: 'manual',
  description: 'Historical override — post-VAT-reg expense with input VAT forfeited (not claimed on as-filed return)',
  legal_basis: 'Phase 0 backfill alignment to closed filings; user decision documented in posting_context',
  routing: {
    event_type: 'historical.override',
    conditions: { 'payload.override_type': OVERRIDE_TYPE_INPUT_FORFEITED }
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['override_type', 'expense_account', 'user_decision_ref'],
  compute: (input: ComputeInput): ComputeOutput => buildHistoricalCashOnlyLines({
    payload: input.payload,
    override_type: OVERRIDE_TYPE_INPUT_FORFEITED,
    vat_treatment: OVERRIDE_TYPE_INPUT_FORFEITED,
    context_label: 'post-VAT-reg, input forfeited'
  })
};

// =============================================================================
// H.3 — Historical override: pre-VAT-reg gross expensing (FX-aware)
//
// Used for transactions that occurred BEFORE STG's VAT registration date.
// STG could not recover input VAT pre-registration, so the entire expense
// goes at gross to a 7xxx account with no VAT split, no RC pair.
//
// FX-aware: payload presence of `fx_rate` triggers the 3-line FX shape
// (Dr expense_account service_value / Dr 7710 fx_fee / Cr 2610 bank_amount).
// Without FX inputs, falls back to 2-line gross via `gross_cents`.
//
// Phase 0 callers:
//   - Entry 4 (VINCIT Aug 2025, no FX): Dr 7740 €35 / Cr 2610 €35
//   - Entry 5 (Cursor Aug 2025, FX): Dr 7730 €17.56 / Dr 7710 €0.52 / Cr 2610 €18.08
//   - Entry 6 (Proton Aug 2025, no FX): Dr 7730 €7.99 / Cr 2610 €7.99
// =============================================================================

const H_3: VatMappingEntry = {
  id: 'H.3',
  category: 'historical',
  entry_type: 'manual',
  description: 'Historical override — pre-VAT-registration gross expensing (FX-aware)',
  legal_basis: 'Phase 0 backfill alignment; STG VAT registration documented in posting_context.vat_registration_date',
  routing: {
    event_type: 'historical.override',
    conditions: { 'payload.override_type': OVERRIDE_TYPE_PRE_REGISTRATION_GROSS }
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['override_type', 'expense_account', 'vat_registration_date'],
  compute: (input: ComputeInput): ComputeOutput => buildHistoricalCashOnlyLines({
    payload: input.payload,
    override_type: OVERRIDE_TYPE_PRE_REGISTRATION_GROSS,
    vat_treatment: OVERRIDE_TYPE_PRE_REGISTRATION_GROSS,
    context_label: 'pre-VAT-reg, gross'
  })
};

// =============================================================================
// P.6 — Monthly fixed-asset depreciation
//
// Triggered by a monthly cron (post-MVP) per row in fixed_assets where
// depreciation_start_date <= now() < depreciation_start_date + useful_life_months.
// Phase 0 backfill emits two P.6 entries: 28.02.2026 (first MacBook
// depreciation) and 31.03.2026 (second MacBook depreciation).
//
// Shape: 2-line. Dr 7610 (depreciation expense) / Cr 1239 (accumulated
// depreciation, contra-asset).
// =============================================================================

const P_6: VatMappingEntry = {
  id: 'P.6',
  category: 'period_close',
  entry_type: 'depreciation',
  description: 'Monthly fixed-asset depreciation',
  legal_basis: 'Cabinet Regulation 877; CIT Article 12',
  routing: {
    event_type: 'cron.monthly_depreciation',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['asset_code', 'month_number', 'of_total'],
  compute: (input: ComputeInput): ComputeOutput => {
    const depreciation_cents = requireNumber(input.payload, 'depreciation_cents');
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '7610',
        debit_cents: depreciation_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Pamatlīdzekļu nolietojums (PP&E depreciation expense)'
      },
      {
        line_number: 2,
        account_code: '1239',
        debit_cents: 0,
        credit_cents: depreciation_cents,
        currency: 'EUR',
        narrative: 'Uzkrātais nolietojums (accumulated depreciation)'
      }
    ];
    return { lines, posting_context_extras: { depreciation_cents } };
  }
};

// =============================================================================
// P.7 — Year-end P&L close to retained earnings
//
// Zeroes all P&L accounts (6xxx revenue + 7xxx expenses) and routes the net
// to 3420 (retained earnings — prior years). Caller pre-computes the closing
// lines (which accounts to clear and the resulting net deficit/surplus). Same
// pre-computed shape as P.1 and H.1: caller-supplied `lines` array; engine
// emits verbatim.
//
// Phase 0 backfill: 31.12.2025 — closes 2025 expenses (€131.96 net loss) to
// 3420 prior-years retained earnings. No revenue in 2025 (no completed
// orders), so the close is one-sided expenses → loss carry-forward.
// =============================================================================

const P_7: VatMappingEntry = {
  id: 'P.7',
  category: 'period_close',
  entry_type: 'period_close',
  description: 'Year-end close — P&L accounts zeroed to retained earnings (3420)',
  legal_basis: 'Cabinet Regulation 877; Latvian Commercial Law (annual report)',
  routing: {
    event_type: 'period_close.annual',
    conditions: {}
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['for_year', 'lines'],
  compute: (input: ComputeInput): ComputeOutput => {
    const lines = buildPreComputedLines(input.payload.lines, {
      type_id: 'P.7',
      defaultNarrative: 'Year-end close line'
    });
    return { lines, posting_context_extras: {} };
  }
};

// =============================================================================
// C.1 — Buyer cart payment, EveryPay card path
//
// Trigger: everypay.payment_confirmed AND payment_method='card'.
// Cash leg only — money lands in 2630 EveryPay clearing pending the daily
// settlement (C.3) that releases it to 2610 Swedbank. No VAT until the order
// completes (then O.1–O.5 release the suspense and recognise revenue + VAT).
// =============================================================================

/**
 * Shared compute for C.1 / C.2. Both types follow identical accounting shape
 * — only the bank-rail debit account differs (2630 EveryPay clearing for
 * card, 2610 Swedbank for PIS / bank-link). Factored out so the buyer-wallet
 * 3-line variant (PR C commit 9 / Q3 Option α) lives in one place rather
 * than being duplicated across C.1 / C.2.
 *
 * Required payload keys:
 *   - gross_cart_cents     — total cart price (items + shipping); credits 5590
 *   - buyer_wallet_cents   — optional, defaults to 0; portion paid from buyer
 *                            wallet balance (debits 5351 with counterparty_type='buyer')
 *   - buyer_id             — required only when buyer_wallet_cents > 0; the
 *                            buyer's auth.users.id, recorded in posting_context
 *                            for wallet-integrity attribution. (No counterparty
 *                            row is lazy-created here — counterparties.type
 *                            CHECK doesn't include 'buyer' today, so the line's
 *                            counterparty_id stays null and counterparty_type
 *                            carries the role label.)
 *
 * Entry shape:
 *   buyer_wallet_cents == 0 → 2 lines (legacy): Dr bank_rail / Cr 5590
 *   buyer_wallet_cents  > 0 → 3 lines: Dr bank_rail + Dr 5351 buyer / Cr 5590
 *
 * The 2-line case is byte-identical to the original C.1/C.2 compute pre-PR-C,
 * so existing dispatcher tests and the wallet-free reconciliation path are
 * preserved.
 */
function computeCartPayment(
  input: ComputeInput,
  bankAccountCode: '2630' | '2610',
  bankNarrative: string
): ComputeOutput {
  const gross_cart_cents = requireNumber(input.payload, 'gross_cart_cents');
  const buyer_wallet_cents = requireNumber(input.payload, 'buyer_wallet_cents', {
    allowZero: true
  });
  if (buyer_wallet_cents > gross_cart_cents) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `buyer_wallet_cents (${buyer_wallet_cents}) cannot exceed gross_cart_cents (${gross_cart_cents})`,
      context: { gross_cart_cents, buyer_wallet_cents }
    });
  }
  const everypay_charge_cents = gross_cart_cents - buyer_wallet_cents;

  const lines: ComputedLine[] = [];

  // Bank-rail debit fires unless EveryPay charge is zero (full-wallet-pay
  // cart). Zero-amount lines violate the journal_lines CHECK constraint, so
  // we skip when the charge is zero.
  if (everypay_charge_cents > 0) {
    lines.push({
      line_number: lines.length + 1,
      account_code: bankAccountCode,
      debit_cents: everypay_charge_cents,
      credit_cents: 0,
      currency: 'EUR',
      narrative: bankNarrative
    });
  }

  // Buyer wallet debit (only when buyer used wallet balance). buyer_id is
  // the auth.users.id; counterparty_id stays null because counterparties.type
  // CHECK doesn't include 'buyer' today, but counterparty_type='buyer' marks
  // the line role + posting_context.buyer_id carries attribution for the
  // wallet-integrity dashboard. Lazy-init of a buyer counterparty is a
  // schema-migration follow-up.
  if (buyer_wallet_cents > 0) {
    // requireString validates non-empty; the FK on journal_lines.counterparty_id
    // is null-permissive so we keep counterparty_id=null even though we ARE
    // resolving an attribution id.
    requireString(input.payload, 'buyer_id');
    lines.push({
      line_number: lines.length + 1,
      account_code: '5351',
      debit_cents: buyer_wallet_cents,
      credit_cents: 0,
      currency: 'EUR',
      counterparty_type: 'buyer',
      counterparty_id: null,
      narrative: 'Buyer wallet — debit for cart payment'
    });
  }

  // Suspense credit — always fires (no buyer-wallet-and-no-everypay edge case
  // routes here today, but if it did, both Dr lines summing to gross would
  // balance against this single Cr line).
  lines.push({
    line_number: lines.length + 1,
    account_code: '5590',
    debit_cents: 0,
    credit_cents: gross_cart_cents,
    currency: 'EUR',
    narrative: 'Suspense — pre-completion'
  });

  return {
    lines,
    posting_context_extras: {
      gross_cart_cents,
      buyer_wallet_cents,
      everypay_charge_cents
    }
  };
}

const C_1: VatMappingEntry = {
  id: 'C.1',
  category: 'cash_only',
  entry_type: 'checkout',
  description: 'Buyer cart payment via EveryPay card — cash arrival to clearing, suspense pending completion',
  legal_basis: 'Cash-only flow; VAT recognition deferred to O.1–O.5 at completion',
  routing: {
    event_type: 'everypay.payment_confirmed',
    conditions: { 'payload.payment_method': 'card' }
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['cart_payment_id', 'everypay_payment_id'],
  compute: (input: ComputeInput): ComputeOutput =>
    computeCartPayment(input, '2630', 'EveryPay clearing — card cart payment received')
};

// =============================================================================
// C.2 — Buyer cart payment, PIS / bank-link path
//
// Trigger: everypay.payment_confirmed AND payment_method='bank_link'.
// PIS settles direct to STG's IBAN (no 2630 EveryPay clearing involved); no
// daily settlement step needed.
// =============================================================================

const C_2: VatMappingEntry = {
  id: 'C.2',
  category: 'cash_only',
  entry_type: 'checkout',
  description: 'Buyer cart payment via PIS / bank-link — direct cash arrival to Swedbank, suspense pending completion',
  legal_basis: 'Cash-only flow; VAT recognition deferred to O.1–O.5 at completion',
  routing: {
    event_type: 'everypay.payment_confirmed',
    conditions: { 'payload.payment_method': 'bank_link' }
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['cart_payment_id', 'everypay_payment_id'],
  compute: (input: ComputeInput): ComputeOutput =>
    computeCartPayment(input, '2610', 'Swedbank — PIS cart payment received')
};

// =============================================================================
// C.3 — EveryPay daily settlement to bank
//
// Trigger: everypay.daily_settlement_received. Moves accumulated card cart
// payments from 2630 EveryPay clearing to 2610 Swedbank when EveryPay
// settles the merchant batch. Currently driven by a staff manual action;
// future automation via webhook reuses the same compute() with a different
// trigger.
// =============================================================================

const C_3: VatMappingEntry = {
  id: 'C.3',
  category: 'cash_only',
  entry_type: 'settlement',
  description: 'EveryPay daily settlement — clearing balance moves to Swedbank',
  legal_basis: 'Cash-only inter-asset transfer; no VAT impact',
  routing: {
    event_type: 'everypay.daily_settlement_received',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['everypay_settlement_id', 'batch_date', 'settlement_value_date', 'included_txn_refs'],
  compute: (input: ComputeInput): ComputeOutput => {
    const settlement_cents = requireNumber(input.payload, 'settlement_cents');
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '2610',
        debit_cents: settlement_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Swedbank — EveryPay daily settlement inbound'
      },
      {
        line_number: 2,
        account_code: '2630',
        debit_cents: 0,
        credit_cents: settlement_cents,
        currency: 'EUR',
        narrative: 'EveryPay clearing — settlement clears balance'
      }
    ];
    return { lines, posting_context_extras: { settlement_cents } };
  }
};

// =============================================================================
// C.4 — Wallet withdrawal (KYC gate triggered)
// =============================================================================

const C_4: VatMappingEntry = {
  id: 'C.4',
  category: 'cash_only',
  entry_type: 'payout',
  description: 'Seller wallet withdrawal to bank (KYC compliance gate triggered)',
  legal_basis: 'PSD2 Article 3(b) commercial-agent transitional framing; STG ToS right-of-offset clause',
  routing: {
    event_type: 'seller.withdrawal_requested',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['seller_id', 'withdrawal_ref', 'seller_iban'],
  compute: (input: ComputeInput): ComputeOutput => {
    const withdrawal_cents = requireNumber(input.payload, 'withdrawal_cents');
    if (!input.counterparty?.id) {
      engineInvariant('C.4 compute requires counterparty');
    }
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '5351',
        debit_cents: withdrawal_cents,
        credit_cents: 0,
        currency: 'EUR',
        counterparty_type: 'seller',
        counterparty_id: input.counterparty.id,
        narrative: 'Seller wallet — withdrawal debit'
      },
      {
        line_number: 2,
        account_code: '2610',
        debit_cents: 0,
        credit_cents: withdrawal_cents,
        currency: 'EUR',
        narrative: 'Swedbank — outbound SEPA payout'
      }
    ];
    return { lines, posting_context_extras: { withdrawal_cents } };
  }
};

// =============================================================================
// C.5 — Cash-only refund (full or partial buyer refund)
//
// Trigger: order.refund_initiated. Cash leg only — VAT reversal flows via
// O.7 / O.8 / O.9 (paired emit at refund time).
// Funding source determines the credit account: 'everypay' → Cr 2630;
// 'bank' → Cr 2610. Caller-driven via payload.funding_source.
// =============================================================================

const C_5: VatMappingEntry = {
  id: 'C.5',
  category: 'cash_only',
  entry_type: 'refund',
  description: 'Cash-only refund (cash leg of buyer refund; pairs with O.7/O.8/O.9 for VAT reversal)',
  legal_basis: 'Cash-only flow; VAT reversal deferred to paired O.7/O.8/O.9 emit',
  routing: {
    event_type: 'order.refund_initiated',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['order_id', 'refund_reference', 'funding_source'],
  compute: (input: ComputeInput): ComputeOutput => {
    const refund_cents = requireNumber(input.payload, 'refund_cents');
    const funding_source = requireString(input.payload, 'funding_source');
    if (funding_source !== 'everypay' && funding_source !== 'bank') {
      throw new PostingValidationError({
        code: 'invalid_payload_value',
        reason: `C.5 funding_source must be 'everypay' or 'bank' (got '${funding_source}')`,
        context: { funding_source }
      });
    }
    const credit_account = funding_source === 'everypay' ? '2630' : '2610';
    const credit_narrative = funding_source === 'everypay'
      ? 'EveryPay clearing — refund issued from clearing balance'
      : 'Swedbank — refund issued from bank';
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '2351',
        debit_cents: refund_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Refund clearing — buyer refund pending bank settlement'
      },
      {
        line_number: 2,
        account_code: credit_account,
        debit_cents: 0,
        credit_cents: refund_cents,
        currency: 'EUR',
        narrative: credit_narrative
      }
    ];
    return { lines, posting_context_extras: { refund_cents, funding_source } };
  }
};

// =============================================================================
// C.6 — Share capital contribution (smoke-test path)
// =============================================================================

const C_6: VatMappingEntry = {
  id: 'C.6',
  category: 'cash_only',
  entry_type: 'equity_contribution',
  description: 'Founder share capital contribution received in operating bank',
  legal_basis: 'Commercial Law Article 153 (LV); STG founding documents',
  routing: {
    event_type: 'equity.share_capital_received',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['founder_id', 'founding_doc_ref'],
  compute: (input: ComputeInput): ComputeOutput => {
    const contribution_cents = requireNumber(input.payload, 'contribution_cents');
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '2610',
        debit_cents: contribution_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Swedbank — share capital received'
      },
      {
        line_number: 2,
        account_code: '3110',
        debit_cents: 0,
        credit_cents: contribution_cents,
        currency: 'EUR',
        narrative: 'Pamatkapitāls (share capital)'
      }
    ];
    return { lines, posting_context_extras: { contribution_cents } };
  }
};

// =============================================================================
// C.7 — Shareholder / related-party loan received
//
// Cash inflow from a related party (founder, shareholder, director). Booked
// as a liability on 5340 (Aizņēmumi no saistītajām personām). Latvian transfer
// pricing rules under CIT Article 4 require either market-rate interest or
// documented justification for zero-rate; the loan agreement is captured in
// posting_context.loan_agreement_ref.
//
// Phase 0 backfill: three loans (€50, €100, €2,000) from Aigars Grenins
// dated 28.07.2025, 02.08.2025, 19.01.2026.
// =============================================================================

const C_7: VatMappingEntry = {
  id: 'C.7',
  category: 'cash_only',
  entry_type: 'shareholder_loan',
  description: 'Shareholder / related-party loan received in operating bank',
  legal_basis: 'Latvian Civil Law (loan agreement); CIT Article 4 (transfer pricing — related parties)',
  routing: {
    event_type: 'equity.shareholder_loan_received',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['lender_id', 'loan_agreement_ref'],
  compute: (input: ComputeInput): ComputeOutput => {
    const loan_cents = requireNumber(input.payload, 'loan_cents');
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '2610',
        debit_cents: loan_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Swedbank — shareholder loan received'
      },
      {
        line_number: 2,
        account_code: '5340',
        debit_cents: 0,
        credit_cents: loan_cents,
        currency: 'EUR',
        narrative: 'Aizņēmumi no saistītajām personām (loan from related party)'
      }
    ];
    return { lines, posting_context_extras: { loan_cents } };
  }
};

// =============================================================================
// C.8 — VID VAT refund received
//
// Cash inflow from VID (Valsts ieņēmumu dienests) settling a prior-period
// PVN deklarācija refund position. Clears the VAT receivable on 2380.
//
// Phase 0 backfill: 24.02.2026 — €13.05 refund of January 2026 input VAT
// (laptop RC + data levy + VINCIT B2B).
// =============================================================================

const C_8: VatMappingEntry = {
  id: 'C.8',
  category: 'cash_only',
  entry_type: 'vat_refund',
  description: 'VID VAT refund received in operating bank',
  legal_basis: 'PVN likums (refund of input VAT excess)',
  routing: {
    event_type: 'vid.refund_received',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['vid_payment_ref', 'for_period'],
  compute: (input: ComputeInput): ComputeOutput => {
    const refund_cents = requireNumber(input.payload, 'refund_cents');
    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '2610',
        debit_cents: refund_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Swedbank — VID VAT refund received'
      },
      {
        line_number: 2,
        account_code: '2380',
        debit_cents: 0,
        credit_cents: refund_cents,
        currency: 'EUR',
        narrative: 'Norēķini ar valsts un pašvaldību budžetu (VAT receivable cleared)'
      }
    ];
    return { lines, posting_context_extras: { refund_cents } };
  }
};

// =============================================================================
// C.9 — Cart-time partial refund cash leg
//
// Fires when fulfillCartPayment auto-refunds part of a cart because one or
// more listings became unavailable between cart creation and EveryPay
// confirmation (typical race: reservation timeout, seller-side withdrawal,
// concurrent sale). The C.1/C.2 entry records the full EveryPay charge against
// 2630/2610 Dr and 5590 Cr; this entry reverses the unavailable portion by
// debiting 5590 (no revenue ever recognised for these listings) and crediting
// the bank rail (the EveryPay refund call returns the cash to the same
// clearing account it landed in).
//
// Single type ID with payment_method discrimination inside compute() — the
// reverse-shape mirror of C.1/C.2 (which split into two type IDs sharing an
// event_type). Net effect: 2630 / 2610 reflects actual Swedbank-rail movement
// (+full_charge - refunded_portion = +kept_portion), and 5590 carries only
// the kept-portion suspense for completion-time release. Distinct from C.5
// (post-completion refund cash leg via 2351 refund clearing) because no
// revenue / O.x has been emitted yet — the unavailable portion never reached
// recognition.
// =============================================================================

const C_9: VatMappingEntry = {
  id: 'C.9',
  category: 'cash_only',
  entry_type: 'refund',
  description: 'Cart-time partial refund cash leg — reverses unavailable portion of a cart payment at fulfillment (mirror of C.1/C.2 multi-leg)',
  legal_basis: 'Cash-only flow paired with C.1/C.2; no revenue recognised for the refunded portion (no completion ever fires)',
  routing: {
    event_type: 'cart.partial_refund_cash_leg',
    conditions: {}
  },
  vat_base_rule: { source: 'none' },
  vat_rate_country: null,
  reporting: { pvn_lines: [] },
  posting_context_required_keys: ['cart_payment_id', 'everypay_payment_id', 'payment_method'],
  /**
   * Required payload keys:
   *   - refund_cents              — total refund amount (EveryPay leg + buyer wallet leg)
   *   - payment_method            — 'card' | 'bank_link' (drives 2630 vs 2610 selection)
   *   - buyer_wallet_refund_cents — optional, defaults to 0; portion of the refund
   *                                  credited back to buyer wallet
   *   - buyer_id                  — required only when buyer_wallet_refund_cents > 0;
   *                                  attribution for the Cr 5351 buyer line
   *
   * Entry shape:
   *   buyer_wallet_refund_cents == 0 → 2 lines: Dr 5590 / Cr bank_rail
   *   buyer_wallet_refund_cents  > 0 → 3 lines: Dr 5590 / Cr bank_rail / Cr 5351-buyer
   *
   * The 2-line case is identical to a simple EveryPay-only partial refund;
   * the 3-line case mirrors the C.1/C.2 multi-leg shape in reverse.
   */
  compute: (input: ComputeInput): ComputeOutput => {
    const refund_cents = requireNumber(input.payload, 'refund_cents');
    const payment_method = requireString(input.payload, 'payment_method');
    const buyer_wallet_refund_cents = requireNumber(input.payload, 'buyer_wallet_refund_cents', {
      allowZero: true
    });
    if (payment_method !== 'card' && payment_method !== 'bank_link') {
      throw new PostingValidationError({
        code: 'invalid_payload_value',
        reason: `C.9 payment_method must be 'card' or 'bank_link' (got '${payment_method}')`,
        context: { payment_method }
      });
    }
    if (buyer_wallet_refund_cents > refund_cents) {
      throw new PostingValidationError({
        code: 'invalid_payload_value',
        reason: `buyer_wallet_refund_cents (${buyer_wallet_refund_cents}) cannot exceed refund_cents (${refund_cents})`,
        context: { refund_cents, buyer_wallet_refund_cents }
      });
    }
    const everypay_refund_cents = refund_cents - buyer_wallet_refund_cents;

    const credit_account = payment_method === 'card' ? '2630' : '2610';
    const credit_narrative = payment_method === 'card'
      ? 'EveryPay clearing — partial refund returned to clearing'
      : 'Swedbank — partial refund returned to bank';

    const lines: ComputedLine[] = [
      {
        line_number: 1,
        account_code: '5590',
        debit_cents: refund_cents,
        credit_cents: 0,
        currency: 'EUR',
        narrative: 'Suspense — releases unavailable-portion (no completion will fire)'
      }
    ];

    if (everypay_refund_cents > 0) {
      lines.push({
        line_number: lines.length + 1,
        account_code: credit_account,
        debit_cents: 0,
        credit_cents: everypay_refund_cents,
        currency: 'EUR',
        narrative: credit_narrative
      });
    }

    if (buyer_wallet_refund_cents > 0) {
      requireString(input.payload, 'buyer_id');
      lines.push({
        line_number: lines.length + 1,
        account_code: '5351',
        debit_cents: 0,
        credit_cents: buyer_wallet_refund_cents,
        currency: 'EUR',
        counterparty_type: 'buyer',
        counterparty_id: null,
        narrative: 'Buyer wallet — credit-back for unavailable items'
      });
    }

    return {
      lines,
      posting_context_extras: {
        refund_cents,
        payment_method,
        buyer_wallet_refund_cents,
        everypay_refund_cents
      }
    };
  }
};

// =============================================================================
// MAPPING_TABLE — readonly export consumed by dispatcher.ts
// =============================================================================

/**
 * v3 mapping table — 28 type IDs in scope. First-match-wins routing in
 * dispatcher.ts evaluates in this order against the incoming PostingEvent.
 * Order matters when multiple types share an event_type — e.g. O.2 must
 * precede O.3 because O.2's conditions are stricter (vat_registered +
 * vies_verified_at) and would otherwise fall through to O.3 if not checked
 * first.
 *
 * Outgoing-order types group B2B reverse-charge (O.2 LT, O.4 EE) before B2C
 * OSS (O.5 EE, O.3 LT) before LV catch-all (O.1). Within each group, country
 * ordering is geometrically immaterial — predicates discriminate on
 * `counterparty.country` and never overlap. The B2B-then-B2C ordering
 * preserves the most-specific-first invariant if a future type ever shares an
 * event_type with these.
 *
 * O.7 / O.8 share event_type='order.refunded' but discriminate on
 * `payload.tax_period_alignment in {'current','prior'}` — exact-match
 * disjunction; mutual-exclusivity test enforces no overlap.
 *
 * C.1 / C.2 share event_type='everypay.payment_confirmed' but discriminate
 * on `payload.payment_method in {'card','bank_link'}` — same disjunction.
 *
 * H.1, H.2, H.3 share event_type='historical.override' but have mutually
 * exclusive `payload.override_type` discriminators, so order is for
 * readability rather than precedence.
 *
 * I.6 (asset capitalization) is NOT a routing entry: it's a payload convention
 * where caller passes `expense_account: '1230'` (or sub-account) on the
 * underlying I.x type to capitalize instead of expense.
 *
 * Test enforces mutual exclusivity: every type's representative event must
 * match exactly one type, AND each type must self-match. See
 * dispatcher.test.ts.
 */
export const MAPPING_TABLE: readonly VatMappingEntry[] = [
  // Outgoing — completion (B2B reverse-charge first, then B2C OSS, then LV catch-all)
  O_2,
  O_4,
  O_5,
  O_3,
  O_1,
  // Outgoing — refund credit notes (O.7 / O.8 full; O.9 partial proportional split)
  O_7,
  O_8,
  O_9,
  // Incoming (more specific vat_treatment routing first; I_4 country list excludes EU MS so order with I_3 is safe)
  I_4,
  I_2,
  I_3,
  I_1,
  I_5,
  I_7,
  // Period close
  P_1,
  P_6,
  P_7,
  // Historical (override_type discriminators are mutually exclusive — order is for readability)
  H_1,
  H_2,
  H_3,
  // Cash-only (numeric order; predicates discriminate by event_type / payload — no precedence ambiguity)
  C_1,
  C_2,
  C_3,
  C_4,
  C_5,
  C_6,
  C_7,
  C_8,
  C_9
] as const;

/** Lookup by id. Returns undefined if id not in MAPPING_TABLE. */
export function findMappingById(id: string): VatMappingEntry | undefined {
  return MAPPING_TABLE.find((entry) => entry.id === id);
}
