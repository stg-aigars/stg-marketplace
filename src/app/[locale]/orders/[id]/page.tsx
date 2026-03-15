import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getOrder } from '@/lib/services/orders';
import { OrderDetailClient } from '@/components/orders/OrderDetailClient';

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: `Order ${id.slice(0, 8)}`,
  };
}

export default async function OrderDetailPage({
  params: { id },
}: {
  params: { id: string; locale: string };
}) {
  const { user } = await requireServerAuth();

  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  // Determine user role
  const userRole = order.buyer_id === user.id ? 'buyer' : 'seller';
  const sellerPhone = order.seller_profile?.phone ?? null;

  return (
    <OrderDetailClient
      order={order}
      userRole={userRole}
      sellerPhone={sellerPhone}
    />
  );
}
