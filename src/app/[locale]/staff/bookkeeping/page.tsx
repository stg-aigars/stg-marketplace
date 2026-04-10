'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { Spinner } from '@/components/ui';
import { formatCentsToCurrency, VAT_RATES } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { ORDER_STATUS_CONFIG } from '@/lib/orders/constants';
import type { OrderStatus } from '@/lib/orders/types';
import {
  DATE_RANGE_PRESETS,
  EXCLUDED_FROM_TOTALS,
  resolveVatBreakdownCents,
  downloadCSV,
  formatDateForAPI,
  type OrderBookkeepingData,
  type BookkeepingSummary,
  type CountryVatBreakdown,
} from '@/lib/bookkeeping-utils';
import { DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react/ssr';

interface BookkeepingResponse {
  orders: OrderBookkeepingData[];
  summary: BookkeepingSummary | null;
  countryBreakdown: CountryVatBreakdown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...(['pending_seller', 'accepted', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'] as const).map((s) => ({
    value: s,
    label: ORDER_STATUS_CONFIG[s]?.label ?? s,
  })),
];

export default function StaffBookkeepingPage() {
  const router = useRouter();

  const [data, setData] = useState<BookkeepingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('this_month');
  const [currentPage, setCurrentPage] = useState(1);

  // Summaries are computed server-side from ALL matching orders, not just the current page
  const summary = data?.summary ?? null;
  const countryBreakdown = data?.countryBreakdown ?? [];

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setExporting(true);

      // Fetch ALL matching orders (no pagination) for complete export
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      if (sellerFilter) params.set('seller', sellerFilter);
      params.set('page', '1');
      params.set('limit', '10000');

      const preset = DATE_RANGE_PRESETS.find((p) => p.key === dateRange);
      if (preset) {
        const { start, end } = preset.getRange();
        params.set('date_from', formatDateForAPI(start));
        params.set('date_to', formatDateForAPI(end));
      }

      const res = await fetch(`/api/staff/bookkeeping?${params}`);
      const result = await res.json();

      if (!res.ok || !result.orders?.length) return;

      const { generateBookkeepingCSV } = await import('@/lib/bookkeeping-utils');
      const csv = generateBookkeepingCSV(result.orders);
      const filename = `stg-bookkeeping-${preset?.label.toLowerCase().replace(/\s+/g, '-') || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      if (sellerFilter) params.set('seller', sellerFilter);
      params.set('page', currentPage.toString());
      params.set('limit', '20');

      const preset = DATE_RANGE_PRESETS.find((p) => p.key === dateRange);
      if (preset) {
        const { start, end } = preset.getRange();
        params.set('date_from', formatDateForAPI(start));
        params.set('date_to', formatDateForAPI(end));
      }

      const response = await fetch(`/api/staff/bookkeeping?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch bookkeeping data');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookkeeping data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, sellerFilter, dateRange, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <p className="text-semantic-text-muted mb-4">{error}</p>
        <Button variant="secondary" onClick={fetchData}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[180px] max-w-xs">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Order number..."
            prefix={<MagnifyingGlass size={16} />}
          />
        </form>

        <div className="min-w-[160px]">
          <Input
            value={sellerFilter}
            onChange={(e) => {
              setSellerFilter(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Seller name..."
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          options={STATUS_OPTIONS}
        />

        <Select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value);
            setCurrentPage(1);
          }}
          options={DATE_RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          disabled={!data?.orders?.length || exporting}
        >
          <DownloadSimple size={16} className="mr-1.5" />
          {exporting ? 'Exporting...' : 'CSV'}
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Orders" value={summary.orderCount.toString()} />
          <SummaryCard label="GMV" value={formatCentsToCurrency(summary.gmvCents)} />
          <SummaryCard
            label="Platform revenue"
            value={formatCentsToCurrency(summary.platformRevenue.grossCents + summary.shippingRevenue.grossCents)}
            sub={`Net: ${formatCentsToCurrency(summary.platformRevenue.netCents + summary.shippingRevenue.netCents)}`}
          />
          <SummaryCard label="VAT collected" value={formatCentsToCurrency(summary.totalVatCents)} accent />
          <SummaryCard
            label="Fee VAT"
            value={formatCentsToCurrency(summary.platformRevenue.vatCents)}
            sub={`Gross: ${formatCentsToCurrency(summary.platformRevenue.grossCents)}`}
            accent
          />
          <SummaryCard
            label="Shipping VAT"
            value={formatCentsToCurrency(summary.shippingRevenue.vatCents)}
            sub={`Gross: ${formatCentsToCurrency(summary.shippingRevenue.grossCents)}`}
            accent
          />
        </div>
      )}

      {/* VAT by country breakdown */}
      {countryBreakdown.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
              VAT by country
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-semantic-text-muted border-b border-semantic-border-subtle">
                    <th className="pb-2 font-medium">Country</th>
                    <th className="pb-2 font-medium">Rate</th>
                    <th className="pb-2 font-medium text-right">Orders</th>
                    <th className="pb-2 font-medium text-right">Commission VAT</th>
                    <th className="pb-2 font-medium text-right">Shipping VAT</th>
                    <th className="pb-2 font-medium text-right">Total VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {countryBreakdown.map((row) => (
                    <tr key={row.country} className="border-b border-semantic-border-subtle last:border-0">
                      <td className="py-2 font-medium text-semantic-text-heading">{row.country}</td>
                      <td className="py-2 text-semantic-text-secondary">{(row.vatRate * 100).toFixed(0)}%</td>
                      <td className="py-2 text-right text-semantic-text-secondary">{row.orderCount}</td>
                      <td className="py-2 text-right text-semantic-text-primary">{formatCentsToCurrency(row.commissionVatCents)}</td>
                      <td className="py-2 text-right text-semantic-text-primary">{formatCentsToCurrency(row.shippingVatCents)}</td>
                      <td className="py-2 text-right font-semibold text-semantic-text-heading">{formatCentsToCurrency(row.totalVatCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Loading indicator for subsequent fetches */}
      {loading && data && (
        <div className="text-center py-2">
          <Spinner size="sm" />
        </div>
      )}

      {/* Transaction table */}
      {data && data.orders.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '1100px' }}>
                <thead className="bg-semantic-bg-subtle border-b border-semantic-border-subtle">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Country</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Game price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Fee net</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-warning uppercase tracking-wider">Fee VAT</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Ship net</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-warning uppercase tracking-wider">Ship VAT</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-warning uppercase tracking-wider">Total VAT</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-semantic-text-secondary uppercase tracking-wider">Buyer paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-semantic-border-subtle">
                  {data.orders.map((order) => {
                    const vatRate = VAT_RATES[order.seller_country?.toUpperCase()] ?? 0.21;
                    const commission = resolveVatBreakdownCents(
                      order.platform_commission_cents, order.commission_net_cents, order.commission_vat_cents, vatRate,
                    );
                    const shipping = resolveVatBreakdownCents(
                      order.shipping_cost_cents, order.shipping_net_cents, order.shipping_vat_cents, vatRate,
                    );
                    const totalVatCents = commission.vatCents + shipping.vatCents;
                    const isCancelled = EXCLUDED_FROM_TOTALS.includes(order.status);
                    const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];

                    return (
                      <tr
                        key={order.id}
                        className={`sm:hover:bg-semantic-bg-subtle cursor-pointer transition-colors duration-250 ease-out-custom ${isCancelled ? 'opacity-50' : ''}`}
                        onClick={() => router.push(`/staff/orders/${order.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-semantic-brand">
                            {order.order_number}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-semantic-text-secondary">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusCfg?.badgeVariant ?? 'default'} >
                            {statusCfg?.label ?? order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-semantic-text-muted">
                          {order.seller_country}
                        </td>
                        <td className="px-4 py-3 text-right text-semantic-text-primary">
                          {formatCentsToCurrency(order.items_total_cents)}
                        </td>
                        <td className="px-4 py-3 text-right text-semantic-text-primary">
                          {formatCentsToCurrency(commission.netCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-semantic-warning">
                          {formatCentsToCurrency(commission.vatCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-semantic-text-primary">
                          {formatCentsToCurrency(shipping.netCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-semantic-warning">
                          {formatCentsToCurrency(shipping.vatCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-semantic-warning">
                          {formatCentsToCurrency(totalVatCents)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-semantic-text-heading">
                          {formatCentsToCurrency(order.total_amount_cents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {summary && (
                  <tfoot className="bg-frost-ice/5 border-t-2 border-frost-ice/30">
                    <tr className="font-semibold">
                      <td colSpan={4} className="px-4 py-3 text-sm text-semantic-text-heading">
                        Period totals ({summary.orderCount} orders)
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-semantic-text-heading">
                        {formatCentsToCurrency(summary.gmvCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-semantic-text-heading">
                        {formatCentsToCurrency(summary.platformRevenue.netCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-semantic-warning">
                        {formatCentsToCurrency(summary.platformRevenue.vatCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-semantic-text-heading">
                        {formatCentsToCurrency(summary.shippingRevenue.netCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-semantic-warning">
                        {formatCentsToCurrency(summary.shippingRevenue.vatCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-semantic-warning">
                        {formatCentsToCurrency(summary.totalVatCents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-semantic-text-heading">
                        {formatCentsToCurrency(summary.totalBuyerPaidCents)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {data && data.orders.length === 0 && !loading && (
        <Card>
          <CardBody>
            <p className="text-semantic-text-muted text-center py-8">
              No transactions found for the selected period.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Pagination */}
      {data && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-semantic-text-muted">
            {data.pagination.total} transactions · Page {data.pagination.page} of {data.pagination.total_pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(data.pagination.total_pages, p + 1))}
              disabled={currentPage >= data.pagination.total_pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="text-xs text-semantic-text-muted uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold mt-1 ${accent ? 'text-semantic-warning' : 'text-semantic-text-heading'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-semantic-text-secondary mt-0.5">{sub}</p>}
      </CardBody>
    </Card>
  );
}
