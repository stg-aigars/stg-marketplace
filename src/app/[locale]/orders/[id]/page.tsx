import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getOrder } from '@/lib/services/orders';
import { getDispute } from '@/lib/services/dispute';
import { getReviewForOrder } from '@/lib/reviews/service';
import { getTrackingEvents } from '@/lib/services/tracking';
import { REVIEW_WINDOW_DAYS, REVIEW_ELIGIBLE_STATUSES } from '@/lib/reviews/constants';
import { OrderDetailClient } from '@/components/orders/OrderDetailClient';

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    id
  } = params;

  return {
    title: `Order ${id.slice(0, 8)}`,
  };
}

export default async function OrderDetailPage(
  props: {
    params: Promise<{ id: string; locale: string }>;
  }
) {
  const params = await props.params;

  const {
    id
  } = params;

  const { user } = await requireServerAuth();

  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  // Determine user role
  const userRole = order.buyer_id === user.id ? 'buyer' : 'seller';
  const sellerPhone = order.seller_profile?.phone ?? null;

  // Fetch dispute, review, and tracking data in parallel (independent queries)
  const hasTracking = !!order.barcode;
  const [dispute, existingReview, trackingEvents] = await Promise.all([
    getDispute(id),
    getReviewForOrder(id),
    hasTracking ? getTrackingEvents(id) : Promise.resolve([]),
  ]);
  const orderWithDispute = { ...order, dispute };

  // Compute review eligibility
  const isReviewEligible =
    userRole === 'buyer' &&
    !existingReview &&
    REVIEW_ELIGIBLE_STATUSES.includes(order.status as typeof REVIEW_ELIGIBLE_STATUSES[number]) &&
    order.delivered_at != null &&
    (Date.now() - new Date(order.delivered_at).getTime()) < REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return (
    <OrderDetailClient
      order={orderWithDispute}
      userRole={userRole}
      sellerPhone={sellerPhone}
      existingReview={existingReview}
      isReviewEligible={isReviewEligible}
      trackingEvents={trackingEvents}
    />
  );
}
