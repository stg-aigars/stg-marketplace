/**
 * Shared types for OSS quarterly submission tracking.
 *
 * The `oss_submissions` table stores the SUBMISSION EVENT only — the
 * per-MS aggregate values are computed at query time from `orders` via
 * `aggregateVatByMS({ excludeHomeCountry: 'LV' })`.
 */

import type { VatByMSRow } from '@/lib/vat-aggregation';

/**
 * Member states STG declares OSS for. STG's home is LV; OSS covers
 * cross-border B2C supplies to LT and EE.
 */
export type OssMemberState = 'LT' | 'EE';

export const OSS_MEMBER_STATES: OssMemberState[] = ['LT', 'EE'];

/**
 * Per-MS declared amounts persisted in `oss_submissions.declared_amounts`.
 * Keyed by ISO 3166-1 alpha-2 country code; values are integer cents.
 */
export type OssDeclaredAmounts = Partial<Record<OssMemberState, {
  net_cents: number;
  vat_cents: number;
  order_count: number;
}>>;

export interface OssSubmissionRow {
  id: string;
  quarter_start: string; // YYYY-MM-DD
  quarter_end: string;
  deadline: string;
  supersedes_submission_id: string | null;
  filed_at: string;
  filed_by: string | null;
  declared_amounts: OssDeclaredAmounts;
  payment_reference: string | null;
  payment_cleared_at: string | null;
  confirmation_url: string | null;
  amendment_reason: string | null;
  created_at: string;
}

/**
 * Compute the calendar quarter that contains the given date.
 * Returns ISO date strings (YYYY-MM-DD) in UTC.
 */
export function quarterContaining(date: Date): {
  quarterStart: string;
  quarterEnd: string;
  deadline: string;
  label: string;
} {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed
  const quarter = Math.floor(month / 3); // 0..3
  const startMonth = quarter * 3;
  const startDate = new Date(Date.UTC(year, startMonth, 1));
  const endDate = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of quarter
  // Deadline = end of month following quarter end.
  const deadlineDate = new Date(Date.UTC(year, startMonth + 4, 0));
  return {
    quarterStart: toIsoDate(startDate),
    quarterEnd: toIsoDate(endDate),
    deadline: toIsoDate(deadlineDate),
    label: `Q${quarter + 1} ${year}`,
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Project an aggregateVatByMS row to declared amounts (integer cents).
 * Combines commission + shipping into a single (net, VAT) pair per MS,
 * since OSS reporting is per (MS, rate) — the line breakdown matters
 * for STG bookkeeping but not for the tax authority.
 */
export function projectToDeclared(row: VatByMSRow): OssDeclaredAmounts[OssMemberState] {
  return {
    net_cents: row.commissionNetCents + row.shippingNetCents,
    vat_cents: row.commissionVatCents + row.shippingVatCents,
    order_count: row.orderCount,
  };
}
