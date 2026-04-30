import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Alert } from '@/components/ui';
import { Dac7BlockedAlert } from '@/components/dac7/Dac7BlockedAlert';
import { SellerTermsAcceptanceGate } from '@/components/seller/SellerTermsAcceptanceGate';
import { needsSellerTermsAcceptance } from '@/lib/seller/terms-acceptance';
import { SellPageClient } from './_components/SellPageClient';

export const metadata: Metadata = {
  title: 'Sell a game',
};

export default async function SellPage() {
  const { profile } = await requireServerAuth();

  // Gate ordering is load-bearing. Seller-status suspension must win first
  // (a suspended seller shouldn't be told to fix DAC7 or accept Terms; they
  // should be told they're suspended). Then DAC7 (a hard data-fix) over the
  // Seller Terms gate (a softer acceptance), because a DAC7-blocked user who
  // "accepts" the Seller Agreement would still be unable to list — burning an
  // interaction without fixing anything. Fix the gating reason first, then
  // see the next gate on the next visit. The createListing server-action has
  // mirror-checks for all three (fails closed if a tampered client bypasses
  // these gates).
  const sellerSuspended = profile?.seller_status === 'suspended';
  const dac7Blocked = profile?.dac7_status === 'blocked';
  const needsSellerTerms = needsSellerTermsAcceptance(profile);

  function renderContent() {
    if (sellerSuspended) {
      return (
        <Alert variant="error" title="Selling paused">
          Your selling privileges are currently suspended. If you think this is in error,
          please contact us at <a href="mailto:info@secondturn.games" className="link-brand">info@secondturn.games</a>.
        </Alert>
      );
    }
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
      <h1 className="text-2xl sm:text-3xl font-bold font-platform tracking-tight text-semantic-text-heading mb-6">
        Create a listing
      </h1>
      {renderContent()}
    </div>
  );
}
