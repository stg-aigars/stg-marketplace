import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getMyOffers, getSellerOffers } from '@/lib/offers/actions';
import { NavTabs } from '@/components/ui';
import { OffersManager } from './OffersManager';

export const metadata: Metadata = { title: 'Offers' };

const OFFER_TABS = [
  { key: 'shelf', label: 'Shelf offers', href: '/account/offers' },
  { key: 'wanted', label: 'Wanted offers', href: '/account/offers/wanted' },
];

export default async function OffersPage() {
  await requireServerAuth();
  const [sent, received] = await Promise.all([getMyOffers(), getSellerOffers()]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-4">
        Offers
      </h1>
      <NavTabs tabs={OFFER_TABS} className="mb-6" />
      <OffersManager sent={sent} received={received} />
    </div>
  );
}
