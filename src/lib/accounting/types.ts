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
