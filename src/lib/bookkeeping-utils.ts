/**
 * Bookkeeping utility functions for VAT calculations, date ranges, and CSV export.
 * Used by the Staff Dashboard Bookkeeping view.
 *
 * All monetary values are INTEGER CENTS — format only at display time.
 */

import { formatCentsToCurrency, VAT_RATES, DEFAULT_VAT_RATE } from '@/lib/services/pricing';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Order statuses to exclude from financial totals (but still show in table) */
export const EXCLUDED_FROM_TOTALS = ['cancelled', 'refunded'];

// ============================================================================
// INTERFACES
// ============================================================================

/** VAT breakdown in cents */
export interface VatBreakdownCents {
  grossCents: number;
  netCents: number;
  vatCents: number;
}

/** Order data needed for bookkeeping calculations */
export interface OrderBookkeepingData {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  items_total_cents: number;
  platform_commission_cents: number;
  shipping_cost_cents: number;
  total_amount_cents: number;
  seller_country: string;
  buyer_name: string;
  seller_name: string;
  commission_net_cents: number | null;
  commission_vat_cents: number | null;
  shipping_net_cents: number | null;
  shipping_vat_cents: number | null;
}

/** Aggregated bookkeeping summary */
export interface BookkeepingSummary {
  orderCount: number;
  gmvCents: number;
  totalBuyerPaidCents: number;
  platformRevenue: VatBreakdownCents;
  shippingRevenue: VatBreakdownCents;
  totalVatCents: number;
}

/** Per-country VAT totals */
export interface CountryVatBreakdown {
  country: string;
  vatRate: number;
  commissionVatCents: number;
  shippingVatCents: number;
  totalVatCents: number;
  orderCount: number;
}

/** Date range preset configuration */
export interface DateRangePreset {
  key: string;
  label: string;
  getRange: () => { start: Date; end: Date };
}

// ============================================================================
// DATE RANGE PRESETS
// ============================================================================

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    key: 'this_month',
    label: 'This month',
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    },
  },
  {
    key: 'last_month',
    label: 'Last month',
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    },
  },
  {
    key: 'this_quarter',
    label: 'This quarter',
    getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      return {
        start: new Date(now.getFullYear(), q * 3, 1),
        end: new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59, 999),
      };
    },
  },
  {
    key: 'last_quarter',
    label: 'Last quarter',
    getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3) - 1;
      const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedQ = q < 0 ? 3 : q;
      return {
        start: new Date(year, adjustedQ * 3, 1),
        end: new Date(year, (adjustedQ + 1) * 3, 0, 23, 59, 59, 999),
      };
    },
  },
  {
    key: 'this_year',
    label: 'This year',
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    },
  },
  {
    key: 'last_year',
    label: 'Last year',
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
      };
    },
  },
];

// ============================================================================
// VAT CALCULATION
// ============================================================================

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
// AGGREGATION
// ============================================================================

/**
 * Calculate bookkeeping summary from a list of orders.
 * Excludes cancelled/refunded orders from financial calculations.
 */
export function calculateBookkeepingSummary(orders: OrderBookkeepingData[]): BookkeepingSummary {
  const validOrders = orders.filter((o) => !EXCLUDED_FROM_TOTALS.includes(o.status));

  let gmvCents = 0;
  let totalBuyerPaidCents = 0;
  const platformRevenue: VatBreakdownCents = { grossCents: 0, netCents: 0, vatCents: 0 };
  const shippingRevenue: VatBreakdownCents = { grossCents: 0, netCents: 0, vatCents: 0 };

  for (const order of validOrders) {
    gmvCents += order.items_total_cents;
    totalBuyerPaidCents += order.total_amount_cents;

    const vatRate = VAT_RATES[order.seller_country?.toUpperCase()] ?? DEFAULT_VAT_RATE;

    const commission = resolveVatBreakdownCents(
      order.platform_commission_cents, order.commission_net_cents, order.commission_vat_cents, vatRate,
    );
    platformRevenue.grossCents += commission.grossCents;
    platformRevenue.netCents += commission.netCents;
    platformRevenue.vatCents += commission.vatCents;

    const shipping = resolveVatBreakdownCents(
      order.shipping_cost_cents, order.shipping_net_cents, order.shipping_vat_cents, vatRate,
    );
    shippingRevenue.grossCents += shipping.grossCents;
    shippingRevenue.netCents += shipping.netCents;
    shippingRevenue.vatCents += shipping.vatCents;
  }

  return {
    orderCount: validOrders.length,
    gmvCents,
    totalBuyerPaidCents,
    platformRevenue,
    shippingRevenue,
    totalVatCents: platformRevenue.vatCents + shippingRevenue.vatCents,
  };
}

/**
 * Calculate per-country VAT breakdown for filing.
 */
export function calculateCountryVatBreakdown(orders: OrderBookkeepingData[]): CountryVatBreakdown[] {
  const validOrders = orders.filter((o) => !EXCLUDED_FROM_TOTALS.includes(o.status));
  const byCountry = new Map<string, CountryVatBreakdown>();

  for (const order of validOrders) {
    const country = order.seller_country?.toUpperCase() || 'UNKNOWN';
    const vatRate = VAT_RATES[country] ?? DEFAULT_VAT_RATE;

    const existing = byCountry.get(country) ?? {
      country,
      vatRate,
      commissionVatCents: 0,
      shippingVatCents: 0,
      totalVatCents: 0,
      orderCount: 0,
    };

    const commission = resolveVatBreakdownCents(
      order.platform_commission_cents, order.commission_net_cents, order.commission_vat_cents, vatRate,
    );
    const shipping = resolveVatBreakdownCents(
      order.shipping_cost_cents, order.shipping_net_cents, order.shipping_vat_cents, vatRate,
    );

    existing.commissionVatCents += commission.vatCents;
    existing.shippingVatCents += shipping.vatCents;
    existing.totalVatCents += commission.vatCents + shipping.vatCents;
    existing.orderCount += 1;

    byCountry.set(country, existing);
  }

  return Array.from(byCountry.values()).sort((a, b) => a.country.localeCompare(b.country));
}

// ============================================================================
// CSV EXPORT
// ============================================================================

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateBookkeepingCSV(orders: OrderBookkeepingData[]): string {
  const headers = [
    'Order Number', 'Date', 'Status', 'Country', 'Buyer', 'Seller',
    'Game Price (EUR)', 'Commission Gross (EUR)', 'Commission Net (EUR)', 'Commission VAT (EUR)',
    'Shipping Gross (EUR)', 'Shipping Net (EUR)', 'Shipping VAT (EUR)',
    'Total VAT (EUR)', 'Buyer Paid (EUR)', 'VAT Rate',
  ];

  const rows = orders.map((order) => {
    const vatRate = VAT_RATES[order.seller_country?.toUpperCase()] ?? DEFAULT_VAT_RATE;
    const commission = resolveVatBreakdownCents(
      order.platform_commission_cents, order.commission_net_cents, order.commission_vat_cents, vatRate,
    );
    const shipping = resolveVatBreakdownCents(
      order.shipping_cost_cents, order.shipping_net_cents, order.shipping_vat_cents, vatRate,
    );
    const totalVatCents = commission.vatCents + shipping.vatCents;
    const date = new Date(order.created_at).toISOString().split('T')[0];

    const toCurrency = (cents: number) => (cents / 100).toFixed(2);

    return [
      escapeCSV(order.order_number),
      date,
      order.status,
      order.seller_country || '',
      escapeCSV(order.buyer_name),
      escapeCSV(order.seller_name),
      toCurrency(order.items_total_cents),
      toCurrency(commission.grossCents),
      toCurrency(commission.netCents),
      toCurrency(commission.vatCents),
      toCurrency(shipping.grossCents),
      toCurrency(shipping.netCents),
      toCurrency(shipping.vatCents),
      toCurrency(totalVatCents),
      toCurrency(order.total_amount_cents),
      (vatRate * 100).toFixed(0) + '%',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateForAPI(date: Date): string {
  return date.toISOString();
}
