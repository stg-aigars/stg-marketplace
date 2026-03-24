import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getMyOffers, getSellerOffers } from '@/lib/offers/actions';
import { OffersManager } from './OffersManager';

export const metadata: Metadata = { title: 'Offers' };

export default async function OffersPage() {
  await requireServerAuth();
  const [sent, received] = await Promise.all([getMyOffers(), getSellerOffers()]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Offers
      </h1>
      <OffersManager sent={sent} received={received} />
    </div>
  );
}
