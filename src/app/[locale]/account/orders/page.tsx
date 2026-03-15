import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getUserOrders } from '@/lib/services/orders';
import { OrderTabs } from './OrderTabs';

export const metadata: Metadata = {
  title: 'Your orders',
};

export default async function MyOrdersPage() {
  const { user } = await requireServerAuth();

  const [purchases, sales] = await Promise.all([
    getUserOrders(user.id, 'buyer'),
    getUserOrders(user.id, 'seller'),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Your orders
      </h1>

      <OrderTabs purchases={purchases} sales={sales} />
    </div>
  );
}
