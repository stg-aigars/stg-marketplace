import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt, CaretRight } from '@phosphor-icons/react/ssr';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody } from '@/components/ui';
import { ProfileSettingsSection } from './_components/ProfileSettingsSection';
import { SecuritySection } from './_components/SecuritySection';
import { DataManagementSection } from './_components/DataManagementSection';

export const metadata: Metadata = {
  title: 'Account settings',
};

export default async function AccountSettingsPage(
  props: { searchParams: Promise<{ returnUrl?: string }> }
) {
  const { user, profile } = await requireServerAuth();
  const searchParams = await props.searchParams;

  // Validate returnUrl to prevent open redirects (same check as auth flow)
  const rawReturnUrl = searchParams.returnUrl;
  const returnUrl = rawReturnUrl?.startsWith('/') && !rawReturnUrl.startsWith('//') ? rawReturnUrl : undefined;

  const hasPassword =
    user.app_metadata?.providers?.includes('email') ?? false;
  const authProvider: string = user.app_metadata?.provider ?? 'email';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Account settings
      </h1>
      <div className="space-y-6">
        {profile && <ProfileSettingsSection profile={profile} returnUrl={returnUrl} />}
        <SecuritySection
          email={user.email!}
          hasPassword={hasPassword}
          authProvider={authProvider}
        />
        <DataManagementSection hasPassword={hasPassword} />

        <Link href="/account/settings/tax">
          <Card hoverable>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border-[1.5px] flex items-center justify-center shrink-0 bg-semantic-bg-secondary border-semantic-border-subtle text-semantic-text-muted">
                  <Receipt size={20} weight="regular" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-semantic-text-heading">Tax information</p>
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    EU tax reporting (DAC7) data
                  </p>
                </div>
                <CaretRight size={20} className="text-semantic-text-muted shrink-0" />
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
