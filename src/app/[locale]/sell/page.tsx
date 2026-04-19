import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Dac7BlockedAlert } from '@/components/dac7/Dac7BlockedAlert';
import { SellerTermsAcceptanceGate } from '@/components/seller/SellerTermsAcceptanceGate';
import { needsSellerTermsAcceptance } from '@/lib/seller/terms-acceptance';
import { SellPageClient } from './_components/SellPageClient';

export const metadata: Metadata = {
  title: 'Sell a game',
};

export default async function SellPage() {
  const { profile } = await requireServerAuth();

  // Gate ordering is load-bearing. DAC7 block must win over the Seller Terms
  // gate: a DAC7-blocked user who "accepts" the Seller Agreement would still
  // be unable to list (blocked downstream by the createListing DAC7 guard),
  // and the acceptance would burn an interaction without fixing anything.
  // Fix the tax data first, then see the agreement gate on the next visit.
  const dac7Blocked = profile?.dac7_status === 'blocked';
  const needsSellerTerms = needsSellerTermsAcceptance(profile);

  function renderContent() {
    if (dac7Blocked) return <Dac7BlockedAlert />;
    if (needsSellerTerms) {
      return (
        <SellerTermsAcceptanceGate
          isReAcceptance={profile?.seller_terms_accepted_at != null}
        />
      );
    }
    return <SellPageClient />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Create a listing
      </h1>
      {renderContent()}
    </div>
  );
}
