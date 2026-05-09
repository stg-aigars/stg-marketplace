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
 *    ships only the invoice slice (4 lines: Dr 5351, Cr 6310-C, Cr 6310-S,
 *    Cr 5710-…) because suspense and Unisend accruals are PR #5 lifecycle
 *    integration concerns. The slice is balanced on its own.
 */

import { decomposeFx, requireNumber, requireString, roundHalfUpCents } from './computer';
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

/** STG commission rate (10%) per CLAUDE.md payment model. */
const COMMISSION_RATE = 0.10;

/**
 * Sentinel value distinguishing historical override entries from
 * engine-computed entries in audit queries. Routing condition + posting_context
 * extras both reference this constant — defined here so any future rename lands
 * in one place.
 */
const OVERRIDE_TYPE_HISTORICAL_FILING = 'historical_filing_alignment';

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
 * Shared scaffolding for outgoing order revenue (O.1, O.2, O.3 in PR #2; O.4
 * and O.5 ship in a later PR with the same shape). Produces three or four
 * journal_lines:
 *
 *   1. Dr 5351 seller wallet for (commission + shipping + vat)
 *   2. Cr 6310-C commission revenue
 *   3. Cr 6310-S shipping-mgmt revenue
 *   4. Cr {vat_account} VAT (omitted when vat_account is null — B2B RC case)
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
}): { lines: ComputedLine[]; commission_cents: number; shipping_value_cents: number; vat_cents: number } {
  if (!input.counterparty?.id) {
    engineInvariant('order revenue compute requires counterparty');
  }
  if (input.vat_rate === null) {
    engineInvariant('order revenue compute requires vat_rate');
  }

  const item_value_cents = requireNumber(input.payload, 'item_value_cents');
  const shipping_value_cents = requireNumber(input.payload, 'shipping_value_cents', { allowZero: true });
  const commission_cents = roundHalfUpCents(item_value_cents * COMMISSION_RATE);
  const revenue_base = commission_cents + shipping_value_cents;
  const vat_cents = input.vat_account === null
    ? 0
    : roundHalfUpCents(revenue_base * input.vat_rate);
  const debit_total = revenue_base + vat_cents;

  const lines: ComputedLine[] = [
    {
      line_number: 1,
      account_code: '5351',
      debit_cents: debit_total,
      credit_cents: 0,
      currency: 'EUR',
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: `Seller wallet — commission + shipping${input.vat_account ? ' + VAT' : ''} (${input.context_label})`
    },
    {
      line_number: 2,
      account_code: '6310-C',
      debit_cents: 0,
      credit_cents: commission_cents,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: `Commission revenue (${input.context_label})`
    },
    {
      line_number: 3,
      account_code: '6310-S',
      debit_cents: 0,
      credit_cents: shipping_value_cents,
      currency: 'EUR',
      vat_rate_snapshot: input.vat_rate,
      vat_country: input.vat_country,
      counterparty_type: 'seller',
      counterparty_id: input.counterparty.id,
      narrative: `Shipping-mgmt revenue (${input.context_label})`
    }
  ];

  if (input.vat_account !== null) {
    lines.push({
      line_number: 4,
      account_code: input.vat_account,
      debit_cents: 0,
      credit_cents: vat_cents,
      currency: 'EUR',
      vat_country: input.vat_country,
      narrative: `Output VAT (${input.context_label})`
    });
  }

  return { lines, commission_cents, shipping_value_cents, vat_cents };
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
        vat_cents: result.vat_cents,
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
        vat_cents: 0,
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
        vat_cents: result.vat_cents,
        vat_rate_snapshot: input.vat_rate,
        oss_consumption_ms: 'LT'
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
    if (!input.counterparty?.vendor_code) {
      engineInvariant('I.1 compute requires counterparty.vendor_code');
    }
    const invoice_gross_cents = invoice_net_cents + invoice_vat_cents;
    const payable_account = vendorPayableAccount(input.counterparty.vendor_code);

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
        narrative: 'Vendor payable (gross)'
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
    pvn_lines: ['54', '63'],
    pvn1_pielikums: 'I_dala',
    esl_transaction_code: 'N'
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
// P.1 — Monthly VAT consolidation (refund position)
//
// Caller pre-computes the close: which 5710-* sub-accounts to clear and the
// resulting net refund. Engine emits the lines verbatim. This shape matches
// v3 §D's P.1 spec: no engine-side VAT computation; the consolidation is the
// closing arithmetic done by accounting workflow.
//
// payload.lines: array of { account_code, debit_cents?, credit_cents? }
// payload.closing_period: 'YYYY-MM' (audit metadata)
// payload.net_refund_cents: number (audit metadata; informational)
// =============================================================================

const P_1: VatMappingEntry = {
  id: 'P.1',
  category: 'period_close',
  entry_type: 'period_close',
  description: 'Monthly VAT consolidation, refund position (input VAT > output VAT)',
  legal_basis: 'PVN likums (period close); Cabinet Regulation 877',
  routing: {
    event_type: 'period_close.monthly_refund',
    conditions: {}
  },
  vat_base_rule: { source: 'pre_computed' },
  vat_rate_country: null,
  reporting: { pvn_lines: ['70'] },
  posting_context_required_keys: ['closing_period', 'net_refund_cents', 'lines'],
  compute: (input: ComputeInput): ComputeOutput => {
    const raw_lines = input.payload.lines;
    if (!Array.isArray(raw_lines) || raw_lines.length < 2) {
      throw new Error('P.1 requires payload.lines as array with >= 2 entries');
    }
    const lines: ComputedLine[] = raw_lines.map((rawUnknown, idx) => {
      const raw = rawUnknown as Record<string, unknown>;
      const account_code = requireString(raw, 'account_code');
      const debit_cents = typeof raw.debit_cents === 'number' ? raw.debit_cents : 0;
      const credit_cents = typeof raw.credit_cents === 'number' ? raw.credit_cents : 0;
      return {
        line_number: idx + 1,
        account_code,
        debit_cents,
        credit_cents,
        currency: 'EUR',
        narrative: typeof raw.narrative === 'string' ? raw.narrative : null
      };
    });
    return { lines, posting_context_extras: {} };
  }
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
  compute: (input: ComputeInput): ComputeOutput => {
    const raw_lines = input.payload.lines;
    if (!Array.isArray(raw_lines) || raw_lines.length < 2) {
      throw new Error('H.1 requires payload.lines as array with >= 2 entries');
    }
    const lines: ComputedLine[] = raw_lines.map((rawUnknown, idx) => {
      const raw = rawUnknown as Record<string, unknown>;
      const account_code = requireString(raw, 'account_code');
      const debit_cents = typeof raw.debit_cents === 'number' ? raw.debit_cents : 0;
      const credit_cents = typeof raw.credit_cents === 'number' ? raw.credit_cents : 0;
      return {
        line_number: idx + 1,
        account_code,
        debit_cents,
        credit_cents,
        currency: 'EUR',
        vat_rate_snapshot: typeof raw.vat_rate_snapshot === 'number' ? raw.vat_rate_snapshot : null,
        vat_country: typeof raw.vat_country === 'string' ? raw.vat_country : null,
        narrative: typeof raw.narrative === 'string' ? raw.narrative : 'Historical override line'
      };
    });
    return {
      lines,
      posting_context_extras: { override_type: OVERRIDE_TYPE_HISTORICAL_FILING }
    };
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
// MAPPING_TABLE — readonly export consumed by dispatcher.ts
// =============================================================================

/**
 * The 9 v3 mapping table type IDs in scope for PR #2. First-match-wins
 * routing in dispatcher.ts evaluates entries in this order against the
 * incoming PostingEvent. Order matters when multiple types share an
 * event_type — e.g. O.2 must precede O.3 because O.2's conditions are
 * stricter (vat_registered + vies_verified_at) and would otherwise fall
 * through to O.3 if not checked first.
 *
 * When O.4 (EE B2B reverse-charge) and O.5 (EE B2C OSS) ship in a later PR,
 * insert them between O.2 and O.3 in this same most-specific-first order.
 *
 * Test enforces mutual exclusivity: every type's representative event must
 * match exactly one type, AND each type must self-match. See
 * dispatcher.test.ts.
 */
export const MAPPING_TABLE: readonly VatMappingEntry[] = [
  // Outgoing (most specific routing first — vat_registered before private)
  O_2,
  O_3,
  O_1,
  // Incoming
  I_4,
  I_1,
  // Period close
  P_1,
  // Historical
  H_1,
  // Cash-only
  C_4,
  C_6
] as const;

/** Lookup by id. Returns undefined if id not in MAPPING_TABLE. */
export function findMappingById(id: string): VatMappingEntry | undefined {
  return MAPPING_TABLE.find((entry) => entry.id === id);
}
