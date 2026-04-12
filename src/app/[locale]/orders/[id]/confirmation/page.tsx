import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getOrderConfirmationData } from '@/lib/services/document-service';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { getConditionLabel } from '@/lib/condition-config';
import type { ListingCondition } from '@/lib/listings/types';
import { DocumentLayout } from '@/components/documents/DocumentLayout';
import { DocumentTotals } from '@/components/documents/DocumentTotals';

export default async function OrderConfirmationPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const { user, isStaff } = await requireServerAuth();

  const data = await getOrderConfirmationData(id, user.id, isStaff);
  if (!data) notFound();

  const { order, buyerName, sellerName } = data;

  const walletAppliedCents = order.buyer_wallet_debit_cents ?? 0;
  const cardPaymentCents = order.total_amount_cents - walletAppliedCents;

  const items = order.order_items ?? [];

  return (
    <DocumentLayout
      title="Order Confirmation"
      documentNumber={order.order_number}
      date={order.created_at}
      recipient={
        <p className="font-medium">{buyerName}</p>
      }
    >
      <p className="mb-6 text-sm text-semantic-text-secondary">
        Seller: {sellerName}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-semantic-border-subtle text-left text-xs font-medium uppercase tracking-wide text-semantic-text-secondary">
              <th className="pb-2 pr-4">Item</th>
              <th className="pb-2 pr-4">Condition</th>
              <th className="pb-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-semantic-border-subtle">
                <td className="py-3 pr-4 text-semantic-text-primary">
                  {item.listings?.game_name ?? 'Unknown game'}
                </td>
                <td className="py-3 pr-4 text-semantic-text-secondary">
                  {item.listings?.condition ? getConditionLabel(item.listings.condition as ListingCondition) : ''}
                </td>
                <td className="py-3 text-right text-semantic-text-primary">
                  {formatCentsToCurrency(item.price_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocumentTotals
        rows={[
          { label: 'Items', amountCents: order.items_total_cents },
          { label: 'Shipping', amountCents: order.shipping_cost_cents },
          { label: 'Total paid', amountCents: order.total_amount_cents, bold: true },
        ]}
      />

      <div className="mt-8 rounded-lg bg-semantic-bg-secondary p-4 text-sm print:bg-white">
        <p className="font-medium text-semantic-text-heading">Payment details</p>
        <div className="mt-2 space-y-1 text-semantic-text-secondary">
          {cardPaymentCents > 0 && (
            <div className="flex justify-between">
              <span>
                {order.payment_method === 'bank_link' ? 'Bank link payment' : 'Card payment'}
              </span>
              <span>{formatCentsToCurrency(cardPaymentCents)}</span>
            </div>
          )}
          {walletAppliedCents > 0 && (
            <div className="flex justify-between">
              <span>Wallet applied</span>
              <span>{formatCentsToCurrency(walletAppliedCents)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Date</span>
            <span>{formatDate(order.created_at)}</span>
          </div>
        </div>
      </div>

      {order.terminal_name && (
        <div className="mt-6 rounded-lg bg-semantic-bg-secondary p-4 text-sm print:bg-white">
          <p className="font-medium text-semantic-text-heading">Delivery</p>
          <div className="mt-2 space-y-1 text-semantic-text-secondary">
            <p>Parcel locker: {order.terminal_name}</p>
            {order.terminal_address && <p>{order.terminal_address}</p>}
            {order.terminal_city && order.terminal_postal_code && (
              <p>{order.terminal_city}, {order.terminal_postal_code}</p>
            )}
          </div>
        </div>
      )}
    </DocumentLayout>
  );
}
