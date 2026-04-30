import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getUserOrders } from '@/lib/services/orders';
import { getWonAuctionsAwaitingPayment } from '@/lib/auctions/actions';
import { Alert } from '@/components/ui';
import { OrderTabs } from './OrderTabs';

export const metadata: Metadata = {
  title: 'Your orders',
};

export default async function MyOrdersPage(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const { user } = await requireServerAuth();

  const [purchases, sales, wonAuctions] = await Promise.all([
    getUserOrders(user.id, 'buyer'),
    getUserOrders(user.id, 'seller'),
    getWonAuctionsAwaitingPayment(),
  ]);

  const defaultTab = searchParams.tab === 'sales' ? 'sales' as const : 'purchases' as const;
  const fromCart = searchParams.from === 'cart';
  const cartGroupId = typeof searchParams.group === 'string' ? searchParams.group : undefined;

  // Count total items across orders in the cart group for the success banner
  let cartItemCount = 0;
  let cartSellerCount = 0;
  if (fromCart && cartGroupId) {
    const cartOrders = purchases.filter((o) => o.cart_group_id === cartGroupId);
    cartItemCount = cartOrders.reduce((sum, o) => sum + (o.item_count ?? 1), 0);
    cartSellerCount = cartOrders.length;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {fromCart && cartItemCount > 0 && (
        <Alert variant="success" dismissible className="mb-6">
          Your order for {cartItemCount} {cartItemCount === 1 ? 'game' : 'games'} has been placed.{' '}
          {cartSellerCount > 1 ? `${cartSellerCount} sellers will` : 'The seller will'} be notified.
        </Alert>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold font-platform tracking-tight text-semantic-text-heading mb-6">
        Your orders
      </h1>

      <OrderTabs key={defaultTab} purchases={purchases} sales={sales} wonAuctions={wonAuctions} defaultTab={defaultTab} />
    </div>
  );
}
