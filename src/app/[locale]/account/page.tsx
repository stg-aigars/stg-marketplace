import Link from 'next/link';
import { CaretRight, Package, Wallet, Tag, BookBookmark, Gavel, MagnifyingGlass, Handshake, Heart, GearSix } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getCountryName, getCountryFlag } from '@/lib/country-utils';
import { formatDate } from '@/lib/date-utils';
import { getWalletBalance } from '@/lib/services/wallet';
import { getOnboardingState } from '@/lib/services/onboarding';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { formatCentsToCurrency } from '@/lib/services/pricing';

export const metadata = {
  title: 'Your profile',
};

export default async function AccountPage() {
  const { user, profile } = await requireServerAuth();
  const [walletBalanceCents, onboardingState] = await Promise.all([
    getWalletBalance(user.id),
    getOnboardingState(user, profile),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Your profile
      </h1>

      <OnboardingChecklist state={onboardingState} />

      <Card>
        <CardBody className="space-y-4">
          <div>
            <p className="text-sm text-semantic-text-muted">Display name</p>
            <p className="text-semantic-text-primary">
              {profile?.full_name || 'Not set'}
            </p>
          </div>

          <div>
            <p className="text-sm text-semantic-text-muted">Email</p>
            <p className="text-semantic-text-primary">{user.email}</p>
          </div>

          <div>
            <p className="text-sm text-semantic-text-muted">Country</p>
            <p className="text-semantic-text-primary">
              {profile ? (
                <>
                  <span className={`${getCountryFlag(profile.country)} mr-2`} />
                  {getCountryName(profile.country)}
                </>
              ) : (
                'Not set'
              )}
            </p>
          </div>

          <div>
            <p className="text-sm text-semantic-text-muted">Member since</p>
            <p className="text-semantic-text-primary">
              {profile
                ? formatDate(profile.created_at)
                : '—'}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Quick links */}
      <div className="mt-6 space-y-3">
        {[
          { href: '/account/orders', icon: Package, label: 'Your orders', desc: 'View your purchases and sales', tint: 'bg-[#EDF5F7] border-semantic-brand/20 text-semantic-brand' },
          { href: '/account/wallet', icon: Wallet, label: 'Wallet', desc: walletBalanceCents > 0 ? `Balance: ${formatCentsToCurrency(walletBalanceCents)}` : 'View your earnings and withdrawals', tint: 'bg-semantic-accent-bg border-semantic-accent/20 text-semantic-accent' },
          { href: '/account/listings', icon: Tag, label: 'My Listings', desc: 'Manage your active and past listings', tint: 'bg-[#FBF0EB] border-semantic-primary/20 text-semantic-primary' },
          { href: '/account/shelf', icon: BookBookmark, label: 'My shelf', desc: 'Showcase your game collection', tint: 'bg-[#EEF5EB] border-semantic-success/20 text-semantic-success' },
          { href: '/account/bids', icon: Gavel, label: 'My bids', desc: 'Auctions you have bid on', tint: 'bg-[#F3EDF5] border-aurora-purple/20 text-aurora-purple' },
          { href: '/account/wanted', icon: MagnifyingGlass, label: 'Wanted games', desc: 'Games you are looking for', tint: 'bg-[#EDF5F7] border-semantic-brand/20 text-semantic-brand' },
          { href: '/account/offers', icon: Handshake, label: 'Offers', desc: 'View and manage price offers', tint: 'bg-semantic-accent-bg border-semantic-accent/20 text-semantic-accent' },
          { href: '/account/favorites', icon: Heart, label: 'Favorites', desc: 'Games you have saved for later', tint: 'bg-[#FBF0EB] border-semantic-primary/20 text-semantic-primary' },
          { href: '/account/settings', icon: GearSix, label: 'Settings', desc: 'Email, password, and data management', tint: 'bg-semantic-bg-secondary border-semantic-border-subtle text-semantic-text-muted' },
        ].map(({ href, icon: Icon, label, desc, tint }) => (
          <Link key={href} href={href}>
            <Card hoverable>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg border-[1.5px] flex items-center justify-center shrink-0 ${tint}`}>
                    <Icon size={20} weight="regular" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-semantic-text-heading">{label}</p>
                    <p className="text-sm text-semantic-text-muted mt-0.5">{desc}</p>
                  </div>
                  <CaretRight size={20} className="text-semantic-text-muted shrink-0" />
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
