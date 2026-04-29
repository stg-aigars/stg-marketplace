/**
 * Shared VAT aggregation by member state.
 *
 * Both Bookkeeping (per-country breakdown for the LV VAT return + accountant
 * export) and the OSS tab (per-MS quarterly declaration for non-LV
 * cross-border supplies) read the same orders with the same VAT columns.
 * Without a shared helper they would silently drift the moment someone fixes
 * a rounding bug or VAT-split nuance in one — see plan finding 8 for context.
 *
 * Rounding contract (load-bearing):
 *   This module returns INTEGER CENTS at every boundary — no intermediate
 *   floating-point conversions, no display-format conversions. Both consumers
 *   convert cents → euros and apply locale-formatted decimal places ONLY at
 *   the rendering boundary, never on this module's output. This is what makes
 *   the verification "Bookkeeping cross-border filter and OSS quarter total
 *   reconcile exactly" actually exact rather than "exact ± a few cents from
 *   accumulated display rounding."
 *
 * Do not modify this file to add display formatting or floating-point math.
 */

import { DEFAULT_VAT_RATE, getVatRate } from '@/lib/services/pricing';

// ============================================================================
// PRIMITIVES (foundational types + helpers shared across consumers)
// ============================================================================

/** Order statuses to exclude from financial totals (but still show in table).
 *  Must match the WHERE clause in get_bookkeeping_summary RPC. */
export const EXCLUDED_FROM_TOTALS = ['cancelled', 'refunded'];

export interface VatBreakdownCents {
  grossCents: number;
  netCents: number;
  vatCents: number;
}

/** Subset of order fields needed to compute VAT aggregations. */
export interface OrderFinancialData {
  status: string;
  seller_country: string;
  items_total_cents: number;
  shipping_cost_cents: number;
  platform_commission_cents: number;
  total_amount_cents: number;
  commission_net_cents: number | null;
  commission_vat_cents: number | null;
  shipping_net_cents: number | null;
  shipping_vat_cents: number | null;
}

/**
 * Resolve VAT breakdown from stored per-order columns, falling back to
 * rate-based calculation for legacy orders.
 */
export function resolveVatBreakdownCents(
  grossCents: number,
  storedNetCents: number | null,
  storedVatCents: number | null,
  vatRate: number = DEFAULT_VAT_RATE,
): VatBreakdownCents {
  if (storedNetCents != null) {
    return {
      grossCents,
      netCents: storedNetCents,
      vatCents: storedVatCents ?? 0,
    };
  }
  // Fallback: extract VAT from gross using rate
  const netCents = Math.round(grossCents / (1 + vatRate));
  return { grossCents, netCents, vatCents: grossCents - netCents };
}

// ============================================================================
// PER-MS AGGREGATION
// ============================================================================

/**
 * Per (MS, rate) aggregate. Both commission and shipping line totals are
 * carried alongside; consumers project as needed.
 *
 *   `ms`           — ISO 3166-1 alpha-2 country code, uppercased. 'UNKNOWN'
 *                    if `seller_country` is null/missing.
 *   `rate`         — VAT rate as a fraction (0.21, 0.24). One row per MS
 *                    (sellers' rate is determined by their country, so
 *                    rate is constant within an MS).
 *   `commission*`  — STG's commission line (Article 58 ESS).
 *   `shipping*`    — Shipping re-supply line (Articles 49/50).
 *   `orderCount`   — Number of contributing orders.
 */
export interface VatByMSRow {
  ms: string;
  rate: number;
  commissionNetCents: number;
  commissionVatCents: number;
  shippingNetCents: number;
  shippingVatCents: number;
  orderCount: number;
}

export interface AggregateVatByMSOptions {
  /**
   * When set, rows with `ms` equal to this value (case-insensitive) are
   * excluded. Used by the OSS tab to drop the home country (LV) — those
   * supplies feed the regular LV VAT return, not OSS.
   */
  excludeHomeCountry?: string;
}

/**
 * Aggregate VAT by member state. Excludes orders in EXCLUDED_FROM_TOTALS
 * (cancelled, refunded) — same scope as Bookkeeping summary aggregations.
 */
export function aggregateVatByMS(
  orders: OrderFinancialData[],
  options: AggregateVatByMSOptions = {},
): VatByMSRow[] {
  const exclude = options.excludeHomeCountry?.toUpperCase();
  const validOrders = orders.filter((o) => !EXCLUDED_FROM_TOTALS.includes(o.status));
  const byMS = new Map<string, VatByMSRow>();

  for (const order of validOrders) {
    const ms = order.seller_country?.toUpperCase() || 'UNKNOWN';
    if (exclude && ms === exclude) continue;

    const rate = getVatRate(order.seller_country);

    const existing = byMS.get(ms) ?? {
      ms,
      rate,
      commissionNetCents: 0,
      commissionVatCents: 0,
      shippingNetCents: 0,
      shippingVatCents: 0,
      orderCount: 0,
    };

    const commission = resolveVatBreakdownCents(
      order.platform_commission_cents,
      order.commission_net_cents,
      order.commission_vat_cents,
      rate,
    );
    const shipping = resolveVatBreakdownCents(
      order.shipping_cost_cents,
      order.shipping_net_cents,
      order.shipping_vat_cents,
      rate,
    );

    existing.commissionNetCents += commission.netCents;
    existing.commissionVatCents += commission.vatCents;
    existing.shippingNetCents += shipping.netCents;
    existing.shippingVatCents += shipping.vatCents;
    existing.orderCount += 1;

    byMS.set(ms, existing);
  }

  return Array.from(byMS.values()).sort((a, b) => a.ms.localeCompare(b.ms));
}
