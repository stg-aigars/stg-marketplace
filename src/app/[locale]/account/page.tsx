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
    </div>
  );
}
