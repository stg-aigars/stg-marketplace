/**
 * Phase 0 backfill — data table.
 *
 * 23 historical journal entries reconstructing STG's GL state from SIA founding
 * (May 2025) through 31.03.2026 closing balance. Each entry is a pre-built
 * `PostingEvent` ready for the engine's `emit(supabase, event)`. Source-of-truth
 * is `stg-phase-0-backfill-execution-v2.md` — every numeric and date below
 * traces back to that spec or to the original Swedbank statements / C&C
 * invoice it cites.
 *
 * Entry numbering convention:
 *   - `phase0_entry_<N>` for N=1..20: numbered entries matching v2 spec line
 *     numbers (with one local renumber for Entry 12 = December H.1 catch-up).
 *   - `phase0_entry_14a` / `phase0_entry_14b`: the C&C MacBook split. Both
 *     reference invoice 3308109; 14a is the laptop (I.2 with capitalize), 14b
 *     is the data carrier levy (I.1 standard VAT). Two separate journal entries
 *     because the two lines have different VAT mechanisms (RC vs standard).
 *   - `phase0_close_<period>`: system-generated period closes that don't have
 *     spec line numbers (`phase0_close_2025_yearend` for P.7, `phase0_close_2026_01`
 *     for January P.1).
 *
 * Both prefixes share the `phase0_` root, so audit queries
 * `WHERE source_doc_id LIKE 'phase0_%'` capture all 23 emits.
 *
 * Account-naming translation (codebase wins; spec doc is stale historical):
 *   - 5721-* → 5710-* (per CLAUDE.md, the spec's 5721-* naming was
 *     superseded by accountant-confirmed 5710-* before PR #1 shipped)
 *   - 2310-VID → 2380 (accountant-confirmed)
 *
 * Every entry carries `posting_context.backfill = true` and
 * `posting_context.phase0_entry_number = '<N>'` so PR #4 trial-balance views
 * can filter and so audit queries are cheap.
 */

import './_load-env';

import {
  OVERRIDE_TYPE_HISTORICAL_FILING,
  OVERRIDE_TYPE_INPUT_FORFEITED,
  OVERRIDE_TYPE_PRE_REGISTRATION_GROSS
} from '@/lib/accounting/mapping';
import { SYSTEM_COUNTERPARTY } from '@/lib/accounting/system-counterparties';
import type { PostingEvent } from '@/lib/accounting/types';

// ---------------------------------------------------------------------------
// BackfillEntry — wrapper around PostingEvent with metadata for the runner
// ---------------------------------------------------------------------------

export interface BackfillEntry {
  /** '1' through '20', '14a'/'14b' for the C&C split, 'close_2025_yearend' / 'close_2026_01' for P.7/P.1 */
  readonly entry_number: string;
  /** Human-readable line description for log output */
  readonly description: string;
  /** Pre-built PostingEvent ready for emit() */
  readonly event: PostingEvent;
}

// ---------------------------------------------------------------------------
// Vendor counterparties seeded by the runner before emits.
//
// VINCIT, Vercel, Mollie, C&C are referenced via counterparty_id by I.x type
// emits in the entries below. Seeded with deterministic UUIDs so re-runs are
// idempotent (UPSERT pattern in the runner script).
//
// VID is the existing system counterparty (UUID 0001) seeded by migration 096
// — Entry 18 references it directly via SYSTEM_COUNTERPARTY.VID. STG_INTERNAL
// (UUID 0002) is not used by Phase 0 entries (P.6 / P.7 don't carry a
// counterparty_id; their lines have no external counterparty).
// ---------------------------------------------------------------------------

export interface BackfillCounterparty {
  readonly id: string;
  readonly type: 'vendor';
  readonly full_name: string;
  readonly country: string;
  readonly tax_status: 'private' | 'vat_registered' | null;
  readonly vat_number: string | null;
  readonly vies_verified_at: string | null;
  readonly vendor_code: string;
}

export const BACKFILL_COUNTERPARTIES: readonly BackfillCounterparty[] = [
  {
    // Entry 15 (VINCIT €71.76, post-VAT-reg LV B2B)
    id: 'a1111111-1111-4111-8111-111111111111',
    type: 'vendor',
    full_name: 'VINCIT ONLINE SIA',
    country: 'LV',
    tax_status: 'vat_registered',
    vat_number: null,  // unconfirmed; not required for I.1 routing (LV vendor + standard VAT)
    vies_verified_at: null,
    vendor_code: 'VS'
  },
  {
    // Entry 14a + 14b (C&C MacBook + data carrier levy, LV B2B)
    id: 'a7777777-7777-4777-8777-777777777777',
    type: 'vendor',
    full_name: 'C&C EE OU Latvijas filiale',
    country: 'LV',
    tax_status: 'vat_registered',
    vat_number: 'LV40103177024',
    vies_verified_at: null,
    vendor_code: 'CC'
  },
  {
    // Entry 16 (Mollie €0.01 verification, NL EU B2B)
    id: 'a5555555-5555-4555-8555-555555555555',
    type: 'vendor',
    full_name: 'Stichting Mollie Payments',
    country: 'NL',
    tax_status: 'vat_registered',
    vat_number: 'NL850853286B01',
    vies_verified_at: '2025-01-01T00:00:00Z',
    vendor_code: 'ML'
  }
];

// ---------------------------------------------------------------------------
// Helpers — used inline below to keep individual entries short
// ---------------------------------------------------------------------------

const VINCIT_ID = BACKFILL_COUNTERPARTIES[0].id;
const CC_ID = BACKFILL_COUNTERPARTIES[1].id;
const MOLLIE_ID = BACKFILL_COUNTERPARTIES[2].id;

export const SOURCE_DOC_TYPE = 'phase0_backfill';

/** Common tag injected into every entry's payload (becomes posting_context). */
function tag(entry_number: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backfill: true,
    phase0_entry_number: entry_number,
    ...extras
  };
}

// ---------------------------------------------------------------------------
// BACKFILL_ENTRIES — 23 emits in posting-date order
// ---------------------------------------------------------------------------

export const BACKFILL_ENTRIES: readonly BackfillEntry[] = [
  // -------------------------------------------------------------------------
  // 2025-07: SIA founding
  // -------------------------------------------------------------------------
  {
    entry_number: '1',
    description: 'Share capital €1.00 — SIA founding (Aigars Greninš)',
    event: {
      event_type: 'equity.share_capital_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_1',
      posting_date: '2025-07-17',
      accounting_period: '2025-07',
      tax_period: '2025-07',
      narrative: 'SIA founding — share capital contribution €1.00',
      payload: tag('1', {
        contribution_cents: 100,
        founder_id: 'AIGARS_GRENINS',
        founding_doc_ref: 'dibināšanas lēmums'
      })
    }
  },
  {
    entry_number: '2',
    description: 'Shareholder loan 1/3 — €50.00 from Aigars Greninš',
    event: {
      event_type: 'equity.shareholder_loan_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_2',
      posting_date: '2025-07-28',
      accounting_period: '2025-07',
      tax_period: '2025-07',
      narrative: 'Shareholder loan 1/3 €50.00 (līg. 28.07.2025)',
      payload: tag('2', {
        loan_cents: 5000,
        lender_id: 'AIGARS_GRENINS',
        loan_agreement_ref: 'līg. 28.07.2025'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2025-08: second loan + first SaaS / agency expenses (pre-VAT-reg)
  // -------------------------------------------------------------------------
  {
    entry_number: '3',
    description: 'Shareholder loan 2/3 — €100.00 from Aigars Greninš',
    event: {
      event_type: 'equity.shareholder_loan_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_3',
      posting_date: '2025-08-02',
      accounting_period: '2025-08',
      tax_period: '2025-08',
      narrative: 'Shareholder loan 2/3 €100.00 (līg. 02.08.2025)',
      payload: tag('3', {
        loan_cents: 10000,
        lender_id: 'AIGARS_GRENINS',
        loan_agreement_ref: 'līg. 02.08.2025'
      })
    }
  },
  {
    entry_number: '4',
    description: 'VINCIT ONLINE €35.00 — pre-VAT-reg domain/hosting',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_4',
      posting_date: '2025-08-04',
      accounting_period: '2025-08',
      tax_period: '2025-08',
      narrative: 'VINCIT ONLINE SIA €35.00 (pre-VAT-reg gross expensing)',
      payload: tag('4', {
        override_type: OVERRIDE_TYPE_PRE_REGISTRATION_GROSS,
        gross_cents: 3500,
        expense_account: '7740',
        vat_registration_date: '2025-08-08',
        vendor_label: 'vincit_online_sia',
        card_auth_ref: '451293'
      })
    }
  },
  {
    entry_number: '5',
    description: 'Cursor $20.00 → €18.08 — pre-VAT-reg with FX',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_5',
      posting_date: '2025-08-05',
      accounting_period: '2025-08',
      tax_period: '2025-08',
      narrative: 'Cursor AI $20.00 (€18.08 EUR billed, FX 1.138952; pre-VAT-reg)',
      payload: tag('5', {
        override_type: OVERRIDE_TYPE_PRE_REGISTRATION_GROSS,
        expense_account: '7730',
        vat_registration_date: '2025-08-08',
        // FX inputs trigger 3-line decomposition (Dr 7730 €17.56 / Dr 7710 €0.52 / Cr 2610 €18.08)
        foreign_amount: 20.00,
        fx_rate: 1.138952,
        bank_amount_eur: 18.08,
        invoice_currency: 'USD',
        fx_rate_source: 'bank_transaction',
        vendor_label: 'cursor',
        vendor_country: 'US',
        card_auth_ref: '328205'
      })
    }
  },
  {
    entry_number: '6',
    description: 'Proton AG €7.99 — pre-VAT-reg (CHF supplier, EUR-billed)',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_6',
      posting_date: '2025-08-05',
      accounting_period: '2025-08',
      tax_period: '2025-08',
      narrative: 'Proton AG €7.99 (CH supplier, EUR-billed; pre-VAT-reg)',
      payload: tag('6', {
        override_type: OVERRIDE_TYPE_PRE_REGISTRATION_GROSS,
        gross_cents: 799,
        expense_account: '7730',
        vat_registration_date: '2025-08-08',
        vendor_label: 'proton_ag',
        vendor_country: 'CH',
        card_auth_ref: '938914'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2025-09: post-VAT-reg but PVN deklarācija filed as zero (input forfeited)
  // -------------------------------------------------------------------------
  {
    entry_number: '7',
    description: 'Cursor $20.00 → €17.74 — post-VAT-reg, input forfeited (FX)',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_7',
      posting_date: '2025-09-05',
      accounting_period: '2025-09',
      tax_period: '2025-09',
      narrative: 'Cursor $20.00 (€17.74 EUR billed, FX 1.160766; post-VAT-reg, input forfeited per Sep 2025 zero return)',
      payload: tag('7', {
        override_type: OVERRIDE_TYPE_INPUT_FORFEITED,
        expense_account: '7730',
        user_decision_ref: 'drop_september_precizeta_2026-05-08',
        // FX inputs trigger 3-line decomposition (Dr 7730 €17.23 / Dr 7710 €0.51 / Cr 2610 €17.74)
        foreign_amount: 20.00,
        fx_rate: 1.160766,
        bank_amount_eur: 17.74,
        invoice_currency: 'USD',
        fx_rate_source: 'bank_transaction',
        vendor_label: 'cursor',
        vendor_country: 'US',
        card_auth_ref: '806348'
      })
    }
  },
  {
    entry_number: '8',
    description: 'Proton AG €7.99 — post-VAT-reg, input forfeited',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_8',
      posting_date: '2025-09-05',
      accounting_period: '2025-09',
      tax_period: '2025-09',
      narrative: 'Proton AG €7.99 (CH supplier, EUR-billed; input forfeited)',
      payload: tag('8', {
        override_type: OVERRIDE_TYPE_INPUT_FORFEITED,
        gross_cents: 799,
        expense_account: '7730',
        user_decision_ref: 'drop_september_precizeta_2026-05-08',
        vendor_label: 'proton_ag',
        vendor_country: 'CH'
      })
    }
  },
  {
    entry_number: '9',
    description: 'Inbokss SIA €9.99 — LV B2B mailbox, input forfeited',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_9',
      posting_date: '2025-09-25',
      accounting_period: '2025-09',
      tax_period: '2025-09',
      narrative: 'Inbokss SIA €9.99 (LV B2B mailbox; €1.73 input VAT not claimed per Sep zero return)',
      payload: tag('9', {
        override_type: OVERRIDE_TYPE_INPUT_FORFEITED,
        gross_cents: 999,
        expense_account: '7730',
        user_decision_ref: 'drop_september_precizeta_2026-05-08',
        would_have_recovered_cents: 173,
        vendor_label: 'inbokss_sia',
        filing_ref: 'EDS_109480798'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2025-10: Cursor only (last subscription month before cancellation)
  // -------------------------------------------------------------------------
  {
    entry_number: '10',
    description: 'Cursor $20.00 → €17.63 — post-VAT-reg, RC rolled to December (FX)',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_10',
      posting_date: '2025-10-05',
      accounting_period: '2025-10',
      tax_period: '2025-10',
      narrative: 'Cursor $20.00 (€17.63 EUR billed, FX 1.168224; RC consolidated into Dec 2025 H.1 catch-up)',
      payload: tag('10', {
        override_type: OVERRIDE_TYPE_INPUT_FORFEITED,
        expense_account: '7730',
        user_decision_ref: 'rolled_to_december_h1_catchup_2026-05-08',
        foreign_amount: 20.00,
        fx_rate: 1.168224,
        bank_amount_eur: 17.63,
        invoice_currency: 'USD',
        fx_rate_source: 'bank_transaction',
        vendor_label: 'cursor',
        vendor_country: 'US'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2025-12: Vercel + December RC catch-up (consolidated filing)
  // -------------------------------------------------------------------------
  {
    entry_number: '11',
    description: 'Vercel $20.00 → €17.54 — post-VAT-reg, RC rolled to December (FX)',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_11',
      posting_date: '2025-12-18',
      accounting_period: '2025-12',
      tax_period: '2025-12',
      narrative: 'Vercel $20.00 (€17.54 EUR billed, FX 1.173709; RC consolidated into Dec 2025 H.1 catch-up)',
      payload: tag('11', {
        override_type: OVERRIDE_TYPE_INPUT_FORFEITED,
        expense_account: '7730',
        user_decision_ref: 'rolled_to_december_h1_catchup_2026-05-08',
        foreign_amount: 20.00,
        fx_rate: 1.173709,
        bank_amount_eur: 17.54,
        invoice_currency: 'USD',
        fx_rate_source: 'bank_transaction',
        vendor_label: 'vercel',
        vendor_country: 'US',
        card_auth_ref: '465410'
      })
    }
  },
  {
    entry_number: '12',
    description: 'December 2025 RC catch-up €7.38 — H.1 filing alignment (Cursor Oct + Vercel Dec)',
    event: {
      event_type: 'historical.override',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_12',
      posting_date: '2025-12-31',
      accounting_period: '2025-12',
      tax_period: '2025-12',
      narrative: 'December 2025 PVN deklarācija RC catch-up €7.38 on declared base €35.17 (rolled Oct Cursor + Dec Vercel; FX €1.01 incorrectly included in base per as-filed return)',
      payload: tag('12', {
        override_type: OVERRIDE_TYPE_HISTORICAL_FILING,
        rc_override_reason: 'match_as_filed_2025_december',
        // Decimal values per v3 mapping table §H.1; required by H.1's posting_context_required_keys
        rc_base_computed: 34.16,  // Cursor service €17.12 + Vercel service €17.04, FX-fee-excluded
        rc_base_filed: 35.17,     // As-filed base, includes €1.01 FX fees (incorrect but accepted)
        filing_ref: 'EDS_110869581',
        rationale: 'User decision 2026-05-08: accept as-filed; no precizēta. Engine must compute base from service value only going forward (excluding FX fees) per §F.',
        lines: [
          {
            account_code: '5710-RC-IN',
            debit_cents: 738,
            credit_cents: 0,
            vat_rate_snapshot: 0.21,
            vat_country: 'LV',
            narrative: 'RC self-assessed input VAT (December as-filed catch-up; covers Cursor Oct + Vercel Dec)'
          },
          {
            account_code: '5710-RC-OUT',
            debit_cents: 0,
            credit_cents: 738,
            vat_rate_snapshot: 0.21,
            vat_country: 'LV',
            narrative: 'RC self-assessed output VAT (December as-filed catch-up)'
          }
        ]
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2025-12-31: year-end P&L close to retained earnings
  // -------------------------------------------------------------------------
  {
    entry_number: 'close_2025_yearend',
    description: '2025 year-end P&L close to retained earnings — net loss €131.96',
    event: {
      event_type: 'period_close.annual',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_close_2025_yearend',
      posting_date: '2025-12-31',
      accounting_period: '2025-12',
      tax_period: '2025-12',
      narrative: '2025 year-end close — P&L accounts zeroed to 3420 retained earnings (net loss €131.96)',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('close_2025_yearend', {
        for_year: '2025',
        lines: [
          {
            account_code: '3420',
            debit_cents: 13196,
            credit_cents: 0,
            narrative: '2025 net loss carried to retained earnings prior years'
          },
          {
            account_code: '7710',
            debit_cents: 0,
            credit_cents: 204,
            narrative: 'Close 7710 Payment processing — 2025 FX fees (Cursor Aug+Sep+Oct + Vercel Dec)'
          },
          {
            account_code: '7730',
            debit_cents: 0,
            credit_cents: 9492,
            narrative: 'Close 7730 IT/SaaS — 2025 SaaS subscriptions (Cursor + Proton + Inbokss + Vercel)'
          },
          {
            account_code: '7740',
            debit_cents: 0,
            credit_cents: 3500,
            narrative: 'Close 7740 Domain/hosting — 2025 VINCIT'
          }
        ]
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-01: VAT-registered operations + month-end P.1 close
  // -------------------------------------------------------------------------
  {
    entry_number: '13',
    description: 'Shareholder loan 3/3 — €2,000.00 from Aigars Greninš',
    event: {
      event_type: 'equity.shareholder_loan_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_13',
      posting_date: '2026-01-20',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'Shareholder loan 3/3 €2,000.00 (līg. 19.01.2026)',
      payload: tag('13', {
        loan_cents: 200000,
        lender_id: 'AIGARS_GRENINS',
        loan_agreement_ref: 'līg. 19.01.2026',
        lender_iban: 'LV07IDXO1001010000062'
      })
    }
  },
  {
    entry_number: '14a',
    description: 'C&C MacBook Pro 14" M5 €1,511.40 — domestic RC, capitalized to 1230 (paid same-day to 2610)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_14a',
      posting_date: '2026-01-20',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'C&C invoice 3308109 — MacBook Pro 14" M5 €1,511.40 (PVN likums Article 143.7 domestic RC; capitalized; paid same-day)',
      counterparty_id: CC_ID,
      payload: tag('14a', {
        invoice_net_cents: 151140,
        // I.6 modifier — capitalize to 1230 instead of expense
        expense_account: '1230',
        // Same-day pay — credit goes to 2610 not 5310-CC
        payable_account: '2610',
        vat_treatment: 'domestic_rc',
        vendor_invoice_number: '3308109',
        vendor_vat_number: 'LV40103177024',
        invoice_date: '2026-01-20',
        invoice_ref: '3308109',
        order_ref: 'PasÅ«tÄ«jums Nr. 275157, atsauce 4289212',
        asset_code: 'IT-2026-001',
        asset_description: 'MacBook Pro 14" Apple M5 16GB/512GB Silver INT',
        asset_serial_number: 'SM9PXG4P2M6'
      })
    }
  },
  {
    entry_number: '14b',
    description: 'C&C data carrier levy €3.45 (€2.85 + €0.60 VAT) — LV standard VAT (paid same-day to 2610)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_14b',
      posting_date: '2026-01-20',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'C&C invoice 3308109 — data carrier levy €3.45 (€2.85 net + €0.60 VAT, standard 21%; paid same-day)',
      counterparty_id: CC_ID,
      payload: tag('14b', {
        invoice_net_cents: 285,
        invoice_vat_cents: 60,
        expense_account: '7770',
        payable_account: '2610',
        vat_treatment: 'standard',
        vendor_invoice_number: '3308109',
        vendor_vat_number: 'LV40103177024',
        invoice_date: '2026-01-20',
        invoice_ref: '3308109',
        invoice_line_label: 'data_carrier_levy'
      })
    }
  },
  {
    entry_number: '15',
    description: 'VINCIT ONLINE €71.76 — LV B2B post-VAT-reg, standard VAT (paid same-day)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_15',
      posting_date: '2026-01-22',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'VINCIT ONLINE SIA €71.76 (€59.31 net + €12.45 input VAT; LV B2B; paid same-day)',
      counterparty_id: VINCIT_ID,
      payload: tag('15', {
        invoice_net_cents: 5931,
        invoice_vat_cents: 1245,
        expense_account: '7740',
        payable_account: '2610',
        vat_treatment: 'standard',
        vendor_invoice_number: 'vincit_22.01.2026',
        vendor_vat_number: 'LV-VINCIT-PLACEHOLDER',
        invoice_date: '2026-01-22',
        card_auth_ref: '843487'
      })
    }
  },
  {
    entry_number: '16',
    description: 'Mollie €0.01 — NL EU B2B verification (RC sub-cent rounds to 0)',
    event: {
      event_type: 'vendor.invoice_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_16',
      posting_date: '2026-01-29',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'Mollie €0.01 NL bank-account verification (EU B2B RC; sub-cent VAT rounds to 0, RC pair omitted)',
      counterparty_id: MOLLIE_ID,
      payload: tag('16', {
        invoice_net_cents: 1,
        expense_account: '7770',
        payable_account: '2610',
        vat_treatment: 'eu_b2b_rc',
        vendor_invoice_number: 'mollie_verification_2026-01-29',
        vendor_vat_number: 'NL850853286B01',
        vendor_country: 'NL',
        invoice_date: '2026-01-29',
        purpose: 'bank_account_verification'
      })
    }
  },
  {
    entry_number: '17',
    description: 'Swedbank foreign-payment commission €0.57 — VAT-exempt financial service',
    event: {
      event_type: 'bank.fee_charged',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_17',
      posting_date: '2026-01-29',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'Swedbank foreign-payment commission €0.57 (PVN likums Article 52 exempt; covers Mollie outbound)',
      payload: tag('17', {
        fee_cents: 57,
        vendor: 'swedbank',
        fee_type: 'foreign_payment',
        vat_treatment: 'exempt_financial_service'
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-01-31: month-end P.1 VAT consolidation (refund position €13.05)
  // -------------------------------------------------------------------------
  {
    entry_number: 'close_2026_01',
    description: 'January 2026 VAT consolidation — €13.05 refund due from VID',
    event: {
      // event_type renamed from 'period_close.monthly_refund' →
      // 'period_close.monthly_vat' in PR C commit 12 (direction-agnostic
      // routing to support both refund and payable positions). The Phase 0
      // backfill's already-posted prod entry was emitted under the legacy
      // name; this script's reference now uses the new name so the script
      // continues to dispatch correctly if re-run (event_type isn't
      // persisted to journal_entries — only type_id='P.1' is — so the
      // historical prod entry is unaffected by the rename).
      event_type: 'period_close.monthly_vat',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_close_2026_01',
      posting_date: '2026-01-31',
      accounting_period: '2026-01',
      tax_period: '2026-01',
      narrative: 'January 2026 VAT consolidation — clears 5710-LV-IN €13.05 + LV-RC pair €317.39; net refund €13.05 to 2380',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('close_2026_01', {
        closing_period: '2026-01',
        net_refund_cents: 1305,
        lines: [
          {
            account_code: '5710-LV-RC-OUT',
            debit_cents: 31739,
            credit_cents: 0,
            narrative: 'Clear LV RC output (January close)'
          },
          {
            account_code: '5710-LV-RC-IN',
            debit_cents: 0,
            credit_cents: 31739,
            narrative: 'Clear LV RC input (January close)'
          },
          {
            account_code: '5710-LV-IN',
            debit_cents: 0,
            credit_cents: 1305,
            narrative: 'Clear LV input VAT — VINCIT €12.45 + C&C levy €0.60 (January close)'
          },
          {
            account_code: '2380',
            debit_cents: 1305,
            credit_cents: 0,
            narrative: 'VID receivable — January 2026 PVN deklarācija refund position'
          }
        ]
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-02: VID refund + first depreciation
  // -------------------------------------------------------------------------
  {
    entry_number: '18',
    description: 'VID VAT refund €13.05 received — settles January 2026 PVN deklarācija',
    event: {
      event_type: 'vid.refund_received',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_18',
      posting_date: '2026-02-24',
      accounting_period: '2026-02',
      tax_period: '2026-02',
      narrative: 'VID refund €13.05 — settles January 2026 PVN deklarācija (ref 90000010008)',
      counterparty_id: SYSTEM_COUNTERPARTY.VID,
      payload: tag('18', {
        refund_cents: 1305,
        vid_payment_ref: '90000010008',
        for_period: '2026-01'
      })
    }
  },
  {
    entry_number: '19',
    description: 'February depreciation €41.98 — MacBook Pro 14" (month 1 of 36)',
    event: {
      event_type: 'cron.monthly_depreciation',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_19',
      posting_date: '2026-02-28',
      accounting_period: '2026-02',
      tax_period: '2026-02',
      narrative: 'Monthly depreciation IT-2026-001 €41.98 (month 1 of 36)',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('19', {
        depreciation_cents: 4198,
        asset_code: 'IT-2026-001',
        month_number: 1,
        of_total: 36
      })
    }
  },

  // -------------------------------------------------------------------------
  // 2026-03: second depreciation (zero-activity month otherwise)
  // -------------------------------------------------------------------------
  {
    entry_number: '20',
    description: 'March depreciation €41.98 — MacBook Pro 14" (month 2 of 36)',
    event: {
      event_type: 'cron.monthly_depreciation',
      source_doc_type: SOURCE_DOC_TYPE,
      source_doc_id: 'phase0_entry_20',
      posting_date: '2026-03-31',
      accounting_period: '2026-03',
      tax_period: '2026-03',
      narrative: 'Monthly depreciation IT-2026-001 €41.98 (month 2 of 36)',
      counterparty_id: SYSTEM_COUNTERPARTY.STG_INTERNAL,
      payload: tag('20', {
        depreciation_cents: 4198,
        asset_code: 'IT-2026-001',
        month_number: 2,
        of_total: 36
      })
    }
  }
];

// ---------------------------------------------------------------------------
// Sanity assertion: 23 emits expected.
//   - 21 numbered entries: 1-20 with slot 14 split into 14a + 14b (the C&C
//     MacBook invoice's two distinct VAT mechanisms)
//   - 2 system-generated period closes (P.7 year-end + P.1 January)
// The plan file's "22" framing counts slots; the implementer-facing count is
// 23 because 14a/14b are independent emits with their own source_doc_ids.
// ---------------------------------------------------------------------------
export const TOTAL_BACKFILL_ENTRIES = 23;
if (BACKFILL_ENTRIES.length !== TOTAL_BACKFILL_ENTRIES) {
  throw new Error(
    `phase0-backfill-data.ts: expected ${TOTAL_BACKFILL_ENTRIES} BACKFILL_ENTRIES, got ${BACKFILL_ENTRIES.length}. ` +
    `If you added/removed an entry, update TOTAL_BACKFILL_ENTRIES + reconciliation harness checkpoints.`
  );
}
