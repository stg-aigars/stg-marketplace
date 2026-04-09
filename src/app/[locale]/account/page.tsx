import Link from 'next/link';
import {
  Package, Wallet, Tag, BookBookmark, Gavel,
  MagnifyingGlass, Handshake, Heart, GearSix, CaretRight, Receipt,
} from '@phosphor-icons/react/ssr';
import { Card, CardBody, Alert } from '@/components/ui';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getDac7Stats } from '@/lib/dac7/service';
import { DAC7_REPORT_TRANSACTIONS, DAC7_REPORT_CONSIDERATION_CENTS } from '@/lib/dac7/constants';
import type { Dac7SellerStatus } from '@/lib/dac7/types';
import { getWalletBalance } from '@/lib/services/wallet';
import { getOnboardingState } from '@/lib/services/onboarding';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getSellerCompletedSales, getActiveListingCount } from '@/lib/services/sellers';
import { getSellerRating } from '@/lib/reviews/service';
import { getPendingActions } from '@/lib/services/pending-actions';
import { AccountHeader } from './AccountHeader';
import { ActionStrip } from './ActionStrip';
import { SellerMetrics } from './SellerMetrics';

export const metadata = {
  title: 'Your profile',
};

export default async function AccountPage() {
  const { user, profile } = await requireServerAuth();

  const [
    walletBalanceCents,
    completedSales,
    activeListings,
    sellerRating,
    pendingActions,
    onboardingState,
    dac7Stats,
  ] = await Promise.all([
    getWalletBalance(user.id),
    getSellerCompletedSales(user.id),
    getActiveListingCount(user.id),
    getSellerRating(user.id),
    getPendingActions(user.id),
    getOnboardingState(user, profile),
    getDac7Stats(user.id),
  ]);

  const isSeller = completedSales > 0 || activeListings > 0;

  const sellingLinks = [
    { href: '/account/orders?tab=sales', icon: Package, label: 'Sales', desc: "Orders you're fulfilling", tint: 'bg-semantic-primary-bg border-semantic-primary/20 text-semantic-primary' },
    { href: '/account/listings', icon: Tag, label: 'Listings', desc: 'Active and past listings', tint: 'bg-semantic-primary-bg border-semantic-primary/20 text-semantic-primary' },
    { href: '/account/wallet', icon: Wallet, label: 'Wallet', desc: walletBalanceCents > 0 ? `Balance: ${formatCentsToCurrency(walletBalanceCents)}` : 'Earnings and withdrawals', tint: 'bg-semantic-accent-bg border-semantic-accent/20 text-semantic-accent' },
    { href: '/account/offers', icon: Handshake, label: 'Offers', desc: 'Price offers and negotiations', tint: 'bg-semantic-accent-bg border-semantic-accent/20 text-semantic-accent' },
    { href: '/account/shelf', icon: BookBookmark, label: 'Shelf', desc: 'Your game collection', tint: 'bg-semantic-success-bg border-semantic-success/20 text-semantic-success' },
    { href: '/account/settings/tax', icon: Receipt, label: 'Tax reporting', desc: dac7Stats ? `${dac7Stats.completed_transaction_count}/${DAC7_REPORT_TRANSACTIONS} sales · ${formatCentsToCurrency(dac7Stats.total_consideration_cents)}/${formatCentsToCurrency(DAC7_REPORT_CONSIDERATION_CENTS)}` : 'EU tax reporting (DAC7)', tint: 'bg-semantic-bg-secondary border-semantic-border-subtle text-semantic-text-muted' },
  ];

  const buyingLinks = [
    { href: '/account/orders?tab=purchases', icon: Package, label: 'Purchases', desc: "Orders you've placed", tint: 'bg-semantic-brand-bg border-semantic-brand/20 text-semantic-brand' },
    { href: '/account/bids', icon: Gavel, label: 'Bids', desc: "Auctions you've bid on", tint: 'bg-semantic-purple-bg border-aurora-purple/20 text-aurora-purple' },
    { href: '/account/favorites', icon: Heart, label: 'Favorites', desc: 'Saved for later', tint: 'bg-semantic-primary-bg border-semantic-primary/20 text-semantic-primary' },
    { href: '/account/wanted', icon: MagnifyingGlass, label: 'Wanted', desc: "Games you're looking for", tint: 'bg-semantic-brand-bg border-semantic-brand/20 text-semantic-brand' },
  ];

  const settingsLink = {
    href: '/account/settings', icon: GearSix, label: 'Settings', desc: 'Email, password, and data', tint: 'bg-semantic-bg-secondary border-semantic-border-subtle text-semantic-text-muted',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <AccountHeader
        fullName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        country={profile?.country ?? null}
      />

      <OnboardingChecklist state={onboardingState} />

      <ActionStrip actions={pendingActions} />

      <Dac7Alert status={profile?.dac7_status ?? 'not_applicable'} />

      {isSeller && (
        <SellerMetrics
          userId={user.id}
          walletBalanceCents={walletBalanceCents}
          activeListings={activeListings}
          completedSales={completedSales}
          positivePct={sellerRating.positivePct}
          ratingCount={sellerRating.ratingCount}
        />
      )}

      {isSeller && (
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading mb-3">
            Selling
          </h2>
          <div className="space-y-3">
            {sellingLinks.map((link) => (
              <QuickLinkCard key={link.href} {...link} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading mb-3">
          Buying
        </h2>
        <div className="space-y-3">
          {buyingLinks.map((link) => (
            <QuickLinkCard key={link.href} {...link} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <QuickLinkCard {...settingsLink} />
      </div>
    </div>
  );
}

function Dac7Alert({ status }: { status: Dac7SellerStatus }) {
  if (status === 'not_applicable' || status === 'data_provided') return null;

  const config: Record<string, { variant: 'info' | 'warning' | 'error'; text: string }> = {
    approaching: {
      variant: 'info',
      text: 'You are approaching the EU tax reporting threshold. We may need additional information from you soon.',
    },
    data_requested: {
      variant: 'warning',
      text: 'You have reached the EU tax reporting threshold. Please provide your tax information.',
    },
    reminder_sent: {
      variant: 'warning',
      text: 'Reminder: We still need your tax information. Your account may be restricted if not provided soon.',
    },
    blocked: {
      variant: 'error',
      text: 'Your ability to create new listings and withdraw funds has been paused. Please provide your tax information to restore access.',
    },
  };

  const { variant, text } = config[status] ?? { variant: 'info' as const, text: '' };
  if (!text) return null;

  return (
    <div className="mb-4">
      <Alert variant={variant}>
        <p>{text}</p>
        <Link href="/account/settings/tax" className="text-sm font-medium underline mt-1 inline-block">
          Go to tax settings
        </Link>
      </Alert>
    </div>
  );
}

function QuickLinkCard({ href, icon: Icon, label, desc, tint }: {
  href: string;
  icon: typeof Tag;
  label: string;
  desc: string;
  tint: string;
}) {
  return (
    <Link href={href}>
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
  );
}
