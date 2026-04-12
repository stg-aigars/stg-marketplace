import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getCreditNoteData } from '@/lib/services/document-service';
import { resolveVatBreakdownCents } from '@/lib/bookkeeping-utils';
import { getVatRate, formatPrice, formatCentsToCurrency } from '@/lib/services/pricing';
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

  // Resolve VAT breakdowns for the original charge (then negate for credit note)
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

  const toEuros = (cents: number) => cents / 100;

  // Credit note line items are negative (reversals)
  const lineItems: LineItem[] = [
    {
      description: 'Reversal: commission on sale',
      grossEuros: -toEuros(commission.grossCents),
      netEuros: -toEuros(commission.netCents),
      vatRate,
      vatEuros: -toEuros(commission.vatCents),
    },
    {
      description: 'Reversal: shipping management',
      grossEuros: -toEuros(shipping.grossCents),
      netEuros: -toEuros(shipping.netCents),
      vatRate,
      vatEuros: -toEuros(shipping.vatCents),
    },
  ];

  const totalGrossEuros = -toEuros(commission.grossCents + shipping.grossCents);
  const totalNetEuros = -toEuros(commission.netCents + shipping.netCents);
  const totalVatEuros = -toEuros(commission.vatCents + shipping.vatCents);

  const sellerWalletClawbackEuros = toEuros(order.seller_wallet_credit_cents ?? 0);
  const commissionReversedEuros = toEuros(commission.grossCents);
  const buyerRefundEuros = toEuros(order.refund_amount_cents ?? order.total_amount_cents);

  return (
    <DocumentLayout
      title="Credit Note"
      documentNumber={`CN-${order.order_number}`}
      date={order.refunded_at ?? order.created_at}
      recipient={
        <div>
          <p className="font-medium">{sellerName}</p>
          {sellerCountry && <p>Country: {sellerCountry}</p>}
        </div>
      }
    >
      {/* References */}
      <div className="mb-6 text-sm text-semantic-text-secondary">
        <p>Order {order.order_number}</p>
        <p>Original invoice: INV-{order.order_number}</p>
      </div>

      {/* Line items (negative amounts) */}
      <DocumentLineItems items={lineItems} />

      {/* Totals (negative) */}
      <DocumentTotals
        rows={[
          { label: 'Total net', amount: totalNetEuros },
          { label: `VAT (${(vatRate * 100).toFixed(0)}%)`, amount: totalVatEuros },
          { label: 'Credit note total', amount: totalGrossEuros, bold: true },
        ]}
      />

      {/* Refund summary */}
      <div className="mt-8 rounded-lg bg-semantic-bg-secondary p-4 text-sm print:bg-gray-50">
        <p className="font-medium text-semantic-text-heading">Refund summary</p>
        <div className="mt-2 space-y-1 text-semantic-text-secondary">
          <div className="flex justify-between">
            <span>Seller wallet clawback</span>
            <span>{formatPrice(sellerWalletClawbackEuros)}</span>
          </div>
          <div className="flex justify-between">
            <span>Commission reversed</span>
            <span>{formatPrice(commissionReversedEuros)}</span>
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
