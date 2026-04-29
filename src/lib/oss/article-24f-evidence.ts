/**
 * Article 24f evidence aggregation for OSS quarterly returns.
 *
 * Article 24f of Implementing Regulation (EU) 282/2011 requires two
 * non-contradictory pieces of evidence for the customer's MS in cross-border
 * B2C supplies. STG records:
 *
 *   - PRIMARY (declared)   — `seller_country`, snapshotted at order creation
 *                            from `user_profiles.country` (seller's signup
 *                            self-declaration, propagated through listings).
 *   - SECONDARY (IBAN)     — `seller_iban_country_at_order`, the first two
 *                            chars of the seller's most recent non-rejected
 *                            withdrawal_requests.bank_iban at order time.
 *                            Nullable: most first-time sellers don't have a
 *                            withdrawal yet, leaving the chain single-stranded.
 *
 *   - FORENSIC (request IP) — `request_country_at_order`, derived from the
 *                            cf-ipcountry header on the callback request.
 *                            This is the BUYER's geolocation in callback
 *                            flows, NOT the seller's — so it is NOT a primary
 *                            Article 24f piece. Surfaced for forensic context
 *                            only (e.g. fraud investigation, MS-coincidence
 *                            checks where buyer and seller share an MS).
 *
 * Aggregation classifies each order into one of three buckets:
 *   - consistent       — IBAN-country matches seller_country (strong evidence)
 *   - single-stranded  — IBAN-country is null (declared-only, weaker)
 *   - conflicting      — IBAN-country differs from seller_country (review)
 */

import { EXCLUDED_FROM_TOTALS } from '@/lib/vat-aggregation';
import { OSS_MEMBER_STATES, type OssMemberState } from './types';

export interface Article24fEvidenceRow {
  id: string;
  status: string;
  seller_country: string | null;
  seller_iban_country_at_order: string | null;
}

export interface Article24fAggregate {
  total: number;
  consistent: number;
  singleStranded: number;
  conflicting: number;
  /** Up to 20 order IDs that fell into the conflicting bucket — surfaced
   *  inline so staff can investigate without a separate query. */
  conflictingOrderIds: string[];
}

const CONFLICT_SAMPLE_LIMIT = 20;

export function aggregateArticle24fEvidence(
  rows: Article24fEvidenceRow[],
): Partial<Record<OssMemberState, Article24fAggregate>> {
  const result: Partial<Record<OssMemberState, Article24fAggregate>> = {};
  for (const row of rows) {
    if (EXCLUDED_FROM_TOTALS.includes(row.status)) continue;
    const ms = row.seller_country?.toUpperCase() as OssMemberState | undefined;
    if (!ms || !OSS_MEMBER_STATES.includes(ms)) continue;

    const ibanRaw = row.seller_iban_country_at_order?.trim();
    const ibanMs = ibanRaw ? ibanRaw.toUpperCase() : null;

    const existing = result[ms] ?? {
      total: 0,
      consistent: 0,
      singleStranded: 0,
      conflicting: 0,
      conflictingOrderIds: [],
    };
    existing.total += 1;
    if (ibanMs === null) {
      existing.singleStranded += 1;
    } else if (ibanMs === ms) {
      existing.consistent += 1;
    } else {
      existing.conflicting += 1;
      if (existing.conflictingOrderIds.length < CONFLICT_SAMPLE_LIMIT) {
        existing.conflictingOrderIds.push(row.id);
      }
    }
    result[ms] = existing;
  }
  return result;
}
