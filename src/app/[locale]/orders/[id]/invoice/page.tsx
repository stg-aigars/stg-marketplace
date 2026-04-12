import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getCommissionInvoiceData } from '@/lib/services/document-service';
import { resolveVatBreakdownCents } from '@/lib/bookkeeping-utils';
import { getVatRate, formatCentsToCurrency } from '@/lib/services/pricing';
import { DocumentLayout } from '@/components/documents/DocumentLayout';
import { DocumentLineItems, type LineItem } from '@/components/documents/DocumentLineItems';
import { DocumentTotals } from '@/components/documents/DocumentTotals';

export default async function InvoicePage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const { user, isStaff } = await requireServerAuth();

  const data = await getCommissionInvoiceData(id, user.id, isStaff);
  if (!data) notFound();

  const { order, sellerName, sellerCountry } = data;
  const vatRate = getVatRate(sellerCountry);

  const commission = resolveVatBreakdownCents(
    order.platform_commission_cents ?? 0,
    order.commission_net_cents,
    order.commission_vat_cents,
    vatRate,
  );
  const shipping = resolveVatBreakdownCents(
    order.shipping_cost_cents,
    order.shipping_net_cents,
    order.shipping_vat_cents,
    vatRate,
  );

  const lineItems: LineItem[] = [
    {
      description: `Commission on sale of ${formatCentsToCurrency(order.items_total_cents)} (10%)`,
      grossCents: commission.grossCents,
      netCents: commission.netCents,
      vatRate,
      vatCents: commission.vatCents,
    },
    {
      description: 'Shipping management',
      grossCents: shipping.grossCents,
      netCents: shipping.netCents,
      vatRate,
      vatCents: shipping.vatCents,
    },
  ];

  const totalGrossCents = commission.grossCents + shipping.grossCents;
  const totalNetCents = commission.netCents + shipping.netCents;
  const totalVatCents = commission.vatCents + shipping.vatCents;

  return (
    <DocumentLayout
      title="Platform Services Invoice"
      documentNumber={`INV-${order.order_number}`}
      date={order.completed_at ?? order.created_at}
      recipient={
        <div>
          <p className="font-medium">{sellerName}</p>
          {sellerCountry && <p>Country: {sellerCountry}</p>}
        </div>
      }
    >
      <p className="mb-6 text-sm text-semantic-text-secondary">
        Order {order.order_number}
      </p>

      <DocumentLineItems items={lineItems} />

      <DocumentTotals
        rows={[
          { label: 'Total net', amountCents: totalNetCents },
          { label: `VAT (${(vatRate * 100).toFixed(0)}%)`, amountCents: totalVatCents },
          { label: 'Invoice total', amountCents: totalGrossCents, bold: true },
        ]}
      />

      <div className="mt-8 rounded-lg bg-semantic-bg-secondary p-4 text-sm print:bg-white">
        <p className="font-medium text-semantic-text-heading">Payment summary</p>
        <div className="mt-2 space-y-1 text-semantic-text-secondary">
          <div className="flex justify-between">
            <span>Total collected from buyer</span>
            <span>{formatCentsToCurrency(order.total_amount_cents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform services</span>
            <span>-{formatCentsToCurrency(totalGrossCents)}</span>
          </div>
          <div className="flex justify-between font-medium text-semantic-text-heading">
            <span>Credited to seller wallet</span>
            <span>{formatCentsToCurrency(order.seller_wallet_credit_cents ?? 0)}</span>
          </div>
        </div>
      </div>
    </DocumentLayout>
  );
}
