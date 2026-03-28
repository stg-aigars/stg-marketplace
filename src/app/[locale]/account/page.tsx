import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react/ssr';
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
        <Link href="/account/orders">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">Your orders</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    View your purchases and sales
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/wallet">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">Wallet</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    {walletBalanceCents > 0
                      ? `Balance: ${formatCentsToCurrency(walletBalanceCents)}`
                      : 'View your earnings and withdrawals'}
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/listings">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">My Listings</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    Manage your active and past listings
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/shelf">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">My shelf</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    Showcase your game collection
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/bids">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">My bids</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    Auctions you have bid on
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/wanted">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">Wanted games</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    Games you are looking for
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/offers">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">Offers</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    View and manage price offers
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/favorites">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">Favorites</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    Games you have saved for later
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
        <Link href="/account/settings">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-semantic-text-heading">Settings</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    Email, password, and data management
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted" />
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
