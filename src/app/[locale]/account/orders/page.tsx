import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getUserOrders } from '@/lib/services/orders';
import { Alert } from '@/components/ui';
import { OrderTabs } from './OrderTabs';

export const metadata: Metadata = {
  title: 'Your orders',
};

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { user } = await requireServerAuth();

  const [purchases, sales] = await Promise.all([
    getUserOrders(user.id, 'buyer'),
    getUserOrders(user.id, 'seller'),
  ]);

  const fromCart = searchParams.from === 'cart';
  const cartGroupId = typeof searchParams.group === 'string' ? searchParams.group : undefined;

  // Count orders in the cart group for the success banner
  let cartOrderCount = 0;
  if (fromCart && cartGroupId) {
    cartOrderCount = purchases.filter((o) => o.cart_group_id === cartGroupId).length;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {fromCart && cartOrderCount > 0 && (
        <Alert variant="success" dismissible className="mb-6">
          Your order for {cartOrderCount} {cartOrderCount === 1 ? 'game' : 'games'} has been placed. Each seller will be notified.
        </Alert>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Your orders
      </h1>

      <OrderTabs purchases={purchases} sales={sales} />
    </div>
  );
}
