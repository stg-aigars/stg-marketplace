import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
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
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
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
      </div>
    </div>
  );
}
