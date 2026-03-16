import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getCountryName, getCountryFlag } from '@/lib/country-utils';
import { formatDate } from '@/lib/date-utils';

export const metadata = {
  title: 'Your profile',
};

export default async function AccountPage() {
  const { user, profile } = await requireServerAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Your profile
      </h1>

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
                <svg className="w-5 h-5 text-semantic-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
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
                <svg className="w-5 h-5 text-semantic-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
