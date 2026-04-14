import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getCreditNoteData } from '@/lib/services/document-service';
import { resolveVatBreakdownCents } from '@/lib/bookkeeping-utils';
import { getVatRate, formatCentsToCurrency } from '@/lib/services/pricing';
import { DocumentLayout } from '@/components/documents/DocumentLayout';
import { DocumentLineItems, type LineItem } from '@/components/documents/DocumentLineItems';
import { DocumentTotals } from '@/components/documents/DocumentTotals';

export default async function CreditNotePage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const { user, isStaff } = await requireServerAuth();

  const data = await getCreditNoteData(id, user.id, isStaff);
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

  // Credit note line items are negative (reversals)
  const lineItems: LineItem[] = [
    {
      description: 'Reversal: commission on sale',
      grossCents: -commission.grossCents,
      netCents: -commission.netCents,
      vatRate,
      vatCents: -commission.vatCents,
    },
    {
      description: 'Reversal: shipping management',
      grossCents: -shipping.grossCents,
      netCents: -shipping.netCents,
      vatRate,
      vatCents: -shipping.vatCents,
    },
  ];

  const totalGrossCents = -(commission.grossCents + shipping.grossCents);
  const totalNetCents = -(commission.netCents + shipping.netCents);
  const totalVatCents = -(commission.vatCents + shipping.vatCents);

  return (
    <DocumentLayout
      title="Credit Note"
      documentNumber={order.credit_note_number ?? `CN-${order.order_number}`}
      date={order.refunded_at ?? order.created_at}
      recipient={
        <div>
          <p className="font-medium">{sellerName}</p>
          {sellerCountry && <p>Country: {sellerCountry}</p>}
        </div>
      }
    >
      <div className="mb-6 text-sm text-semantic-text-secondary">
        <p>Order {order.order_number}</p>
        <p>Original invoice: {order.invoice_number ?? `INV-${order.order_number}`}</p>
      </div>

      <DocumentLineItems items={lineItems} />

      <DocumentTotals
        rows={[
          { label: 'Total net', amountCents: totalNetCents },
          { label: `VAT (${(vatRate * 100).toFixed(0)}%)`, amountCents: totalVatCents },
          { label: 'Credit note total', amountCents: totalGrossCents, bold: true },
        ]}
      />

      <div className="mt-8 rounded-lg bg-semantic-bg-secondary p-4 text-sm print:bg-white">
        <p className="font-medium text-semantic-text-heading">Refund summary</p>
        <div className="mt-2 space-y-1 text-semantic-text-secondary">
          <div className="flex justify-between">
            <span>Seller wallet clawback</span>
            <span>{formatCentsToCurrency(order.seller_wallet_credit_cents ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Commission reversed</span>
            <span>{formatCentsToCurrency(commission.grossCents)}</span>
          </div>
          <div className="flex justify-between font-medium text-semantic-text-heading">
            <span>Buyer refund</span>
            <span>{formatCentsToCurrency(order.refund_amount_cents ?? order.total_amount_cents)}</span>
          </div>
        </div>
      </div>
    </DocumentLayout>
  );
}
