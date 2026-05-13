/**
 * Accounting module types — hand-written, snake_case to match DB columns.
 * Maps to migrations 093 (schema), 094 (triggers), 095 (RLS), 096 (seeds).
 *
 * All monetary values are integer cents stored as bigint in Postgres and
 * `number` in TypeScript. Per CLAUDE.md, JS `number` safely holds integer
 * cents up to 2^53 — adequate for any plausible commercial scale (€90T+).
 */

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'
  | 'contra_asset';

/** 1:1 mapping to public.accounts */
export interface AccountRow {
  code: string;
  name_lv: string;
  name_en: string;
  type: AccountType;
  is_vat: boolean;
  is_active: boolean;
  parent_code: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// periods
// ---------------------------------------------------------------------------

export type PeriodType = 'month' | 'quarter' | 'year';
export type PeriodStatus = 'open' | 'soft_locked' | 'hard_locked';

/** 1:1 mapping to public.periods */
export interface PeriodRow {
  period_key: string;
  period_type: PeriodType;
  status: PeriodStatus;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// vat_rates
// ---------------------------------------------------------------------------

/** 1:1 mapping to public.vat_rates */
export interface VatRateRow {
  country: string;
  rate: number;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// counterparties
// ---------------------------------------------------------------------------

export type CounterpartyType = 'seller' | 'vendor' | 'tax_authority' | 'internal';

export type CounterpartyTaxStatus = 'private' | 'sole_proprietor' | 'vat_registered';

export type CounterpartyComplianceStatus =
  | 'ok'
  | 'pending_kyc'
  | 'dac7_blocked'
  | 'negative_wallet'
  | 'suspended'
  | 'dormant';

export type CounterpartyKycStatus =
  | 'not_required'
  | 'pending'
  | 'verified'
  | 'rejected';

/** 1:1 mapping to public.counterparties */
export interface CounterpartyRow {
  id: string;
  type: CounterpartyType;
  user_id: string | null;
  full_name: string | null;
  country: string | null;
  tax_status: CounterpartyTaxStatus | null;
  tin: string | null;
  vat_number: string | null;
  vies_verified_at: string | null;
  iban: string | null;
  iban_validated_at: string | null;
  legal_compliance_status: CounterpartyComplianceStatus;
  kyc_status: CounterpartyKycStatus;
  kyc_verified_at: string | null;
  vendor_code: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// vendor_invoices
// ---------------------------------------------------------------------------

export type VatTreatment =
  | 'standard'
  | 'domestic_rc'
  | 'eu_b2b_rc'
  | 'non_eu_rc'
  | 'exempt'
  | 'out_of_scope';

export type FxRateSource = 'bank_transaction' | 'ecb_published' | 'invoice_documented';

/** 1:1 mapping to public.vendor_invoices */
export interface VendorInvoiceRow {
  id: string;
  counterparty_id: string;
  vendor_invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  net_amount_cents: number;
  vat_amount_cents: number;
  gross_amount_cents: number;
  vat_treatment: VatTreatment;
  fx_rate: number | null;
  fx_rate_source: FxRateSource | null;
  posted_entry_id: string | null;
  paid_entry_id: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// fixed_assets
// ---------------------------------------------------------------------------

/** 1:1 mapping to public.fixed_assets */
export interface FixedAssetRow {
  id: string;
  asset_code: string;
  description: string;
  serial_number: string | null;
  acquired_date: string;
  acquisition_cost_cents: number;
  vendor_invoice_id: string | null;
  account_code: string;
  useful_life_months: number;
  depreciation_start_date: string;
  disposed_date: string | null;
  disposal_proceeds_cents: number | null;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// journal_entries
// ---------------------------------------------------------------------------

export type JournalEntryType =
  | 'checkout'
  | 'order'
  | 'refund'
  | 'dispute'
  | 'settlement'
  | 'payout'
  | 'accrual'
  | 'manual'
  | 'reversal'
  | 'dormancy'
  | 'writeoff'
  | 'provision'
  | 'depreciation'
  | 'period_close'
  | 'equity_contribution'
  | 'shareholder_loan'
  | 'vendor_invoice'
  | 'vendor_payment'
  | 'vat_refund';

/** 1:1 mapping to public.journal_entries */
export interface JournalEntryRow {
  id: string;
  posting_date: string;
  accounting_period: string;
  tax_period: string;
  entry_type: JournalEntryType;
  /** V3 mapping table type ID (O.1, I.4, P.1, C.4, ...). Added in migration 097. */
  type_id: string;
  source_doc_type: string | null;
  source_doc_id: string | null;
  reverses_entry_id: string | null;
  correction_reason: string | null;
  narrative: string;
  posting_context: Record<string, unknown>;
  created_by: string;
  created_at: string;
  period_close_adjustment: boolean;
}

// ---------------------------------------------------------------------------
// journal_lines
// ---------------------------------------------------------------------------

/** 1:1 mapping to public.journal_lines */
export interface JournalLineRow {
  id: string;
  entry_id: string;
  line_number: number;
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  currency: string;
  fx_rate_snapshot: number | null;
  vat_rate_snapshot: number | null;
  vat_country: string | null;
  counterparty_type: string | null;
  counterparty_id: string | null;
  narrative: string | null;
}

// ---------------------------------------------------------------------------
// Posting engine — internal types (PR #2)
//
// Engine-internal types used by dispatcher / computer / mapping / posting-engine.
// These do not mirror DB columns; they're TypeScript-only contracts between
// the engine modules. Naming: snake_case where they describe DB-column-shaped
// values (line_number, debit_cents); camelCase fine for engine-only fields.
// ---------------------------------------------------------------------------

/** v3 mapping table category. Determines compute & reporting shape. */
export type VatCategory =
  | 'outgoing'
  | 'incoming'
  | 'cash_only'
  | 'period_close'
  | 'historical';

/** Where the VAT base comes from in the payload, if any. */
export type VatBaseSource =
  | 'item_value'         // base = item_value_cents + shipping_value_cents (O.1, O.2, O.3)
  | 'invoice_net'        // base = invoice_net_cents (I.1)
  | 'service_value_fx'   // base = computed via §F FX decomposition (I.4)
  | 'wallet_balance'     // base = capped wallet balance (O.6 dormancy — not in PR #2)
  | 'pre_computed'       // caller supplies all amounts; engine bypasses base computation (H.1)
  | 'none';              // no VAT base (C.4, C.6, P.1)

/** v3 mapping table routing criteria. First-match-wins in dispatcher. */
export interface RoutingCriteria {
  /** Event type the caller passes to emit() — e.g. 'order.completed'. */
  event_type: string;
  /**
   * Routing conditions evaluated against the dispatch context. Keys use
   * dot notation: 'counterparty.country', 'counterparty.tax_status',
   * 'counterparty.vies_verified_at', 'payload.override_type', etc.
   *
   * Special values:
   *   - literal string/boolean/number → exact match
   *   - readonly string array         → IN (any) match
   *   - '!null'                       → field must be non-null
   */
  conditions: Readonly<Record<string, string | boolean | number | readonly string[] | '!null'>>;
}

/** v3 mapping table reporting flags. Drives PVN deklarācija + ESL + OSS outputs. */
export interface ReportingFlags {
  /** PVN deklarācija lines (e.g. ['41','52'] for O.1). Empty for OSS-routed types. */
  pvn_lines: readonly string[];
  /** PVN 1 pielikums section. */
  pvn1_pielikums?: 'I_dala' | 'II_dala' | 'III_dala';
  /** True for B2B reverse-charge sales to EU MS (O.2, O.4) — feeds PVN 2 ESL. */
  pvn2_esl_required?: boolean;
  /** Set to consumption MS for B2C OSS-routed sales (O.3, O.5). */
  oss_required?: 'LT' | 'EE' | null;
  /** ESL transaction code per Article 263 of Directive 2006/112/EC. */
  esl_transaction_code?: 'S' | 'T' | 'R4' | 'A' | 'N';
}

/** Computed journal line (engine-internal, becomes a journal_lines row). */
export interface ComputedLine {
  line_number: number;
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  currency: string;
  fx_rate_snapshot?: number | null;
  vat_rate_snapshot?: number | null;
  vat_country?: string | null;
  counterparty_type?: string | null;
  counterparty_id?: string | null;
  narrative?: string | null;
}

/** Output of a per-type compute function. */
export interface ComputeOutput {
  lines: ComputedLine[];
  /**
   * Engine-computed values to merge into the entry's posting_context.
   * E.g. I.4 adds { service_value_eur_cents, fx_fee_eur_cents, rc_vat_cents }.
   * O.1 typically returns {} since amounts live on lines.
   */
  posting_context_extras: Record<string, unknown>;
}

/** Input to a per-type compute function. */
export interface ComputeInput {
  payload: Record<string, unknown>;
  counterparty: CounterpartyRow | null;
  /**
   * VAT rate snapshot resolved by engine from public.vat_rates(country, posting_date).
   * Null for types with vat_base_rule.source='none' or vat_rate_country=null.
   */
  vat_rate: number | null;
  /** ISO date used to look up vat_rate; passed for narrative/audit context. */
  posting_date: string;
}

/**
 * v3 mapping table entry. Each in-scope type ID has one of these in MAPPING_TABLE
 * (mapping.ts). Future PRs add rows for new types — no engine code change needed.
 */
export interface VatMappingEntry {
  /** Stable type ID — 'O.1', 'I.4', 'P.1', etc. Becomes journal_entries.type_id. */
  id: string;
  category: VatCategory;
  entry_type: JournalEntryType;
  description: string;
  legal_basis: string;
  routing: RoutingCriteria;
  vat_base_rule: { source: VatBaseSource };
  /** ISO2 country whose VAT rate applies, or null for non-VAT types. */
  vat_rate_country: 'LV' | 'LT' | 'EE' | null;
  reporting: ReportingFlags;
  /**
   * Keys the caller MUST supply in payload. Engine validates before compute.
   * Computed-by-engine keys (e.g. service_value_eur_cents for I.4) are NOT in
   * this list — they come from compute(), not the caller.
   */
  posting_context_required_keys: readonly string[];
  /**
   * Pure function: payload + counterparty + vat_rate → lines + extras.
   * Throws PostingValidationError on invalid economic inputs (negative cents,
   * missing required numeric fields after type coercion, etc.).
   */
  compute: (input: ComputeInput) => ComputeOutput;
}

/**
 * Discriminator for the originating system path that produced a journal entry.
 * Merged into `posting_context.emission_source` by `assembleEntryForRpc`; lets
 * dashboards / period-close queries filter test-artifact and backfill entries
 * separately from live lifecycle traffic without resorting to fragile string
 * matches on `source_doc_type`.
 *
 *  - 'lifecycle'    — service-layer wraps (PR #5 / PR C commits 9-11): cart
 *                     fulfillment, order completion, refund, withdrawal
 *  - 'cron'         — scheduled jobs (monthly-depreciation, future P.1 monthly
 *                     close, etc.)
 *  - 'staff_manual' — staff dashboard actions (C.3 EveryPay settlement,
 *                     reversal entries, etc.)
 *  - 'backfill'     — historical reconstruction scripts (Phase 0, April 2026,
 *                     future month-end backfills). Coexists with
 *                     `posting_context.backfill = true` legacy tag; new code
 *                     should set both during the transition window.
 */
export type EmissionSource = 'lifecycle' | 'cron' | 'staff_manual' | 'backfill';

/** What callers pass to engine.emit(). */
export interface PostingEvent {
  /** Routes to a VatMappingEntry. */
  event_type: string;
  source_doc_type: string;
  source_doc_id: string;
  posting_date: string;
  accounting_period: string;
  tax_period: string;
  /** Free-text audit narrative. Engine doesn't mutate. */
  narrative: string;
  /**
   * Counterparty ID — required for events whose routing conditions reference
   * counterparty fields. Engine loads the counterparty row before dispatch.
   */
  counterparty_id?: string;
  /** Economics + audit metadata. Engine validates posting_context_required_keys. */
  payload: Record<string, unknown>;
  /** Defaults to 'posting_engine' if absent. */
  created_by?: string;
  /**
   * Originating system path. Merged into `posting_context.emission_source`
   * by the engine. Optional for backward compatibility with code that hasn't
   * been migrated yet; once every emitter passes a value, this should become
   * required.
   */
  emission_source?: EmissionSource;
  /**
   * Optional override. Used by H.x historical entries that target soft-locked
   * periods. Defaults to false. Only authorised application code should set true.
   */
  period_close_adjustment?: boolean;
}

/** What engine.emit() returns. */
export type PostingResult =
  | { status: 'created'; entry_id: string }
  | { status: 'idempotent_skip'; entry_id: string }
  | { status: 'failed'; error: string };

/** Idempotency check result. */
export type IdempotencyResult =
  | { status: 'fresh' }
  | { status: 'idempotent_skip'; entry_id: string };

/** Internal: dispatcher input (engine builds this after loading counterparty). */
export interface DispatchContext {
  event_type: string;
  counterparty: CounterpartyRow | null;
  payload: Record<string, unknown>;
}
