import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Alert } from '@/components/ui';
import { SellPageClient } from './_components/SellPageClient';

export default async function SellPage() {
  const { profile } = await requireServerAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Create a listing
      </h1>
      {profile?.dac7_status === 'blocked' ? (
        <Alert variant="error">
          <p>
            Your ability to create new listings has been paused because required
            tax reporting information has not been provided.
          </p>
          <Link href="/account/settings/tax" className="text-sm font-medium underline mt-1 inline-block">
            Provide tax information to restore access
          </Link>
        </Alert>
      ) : (
        <SellPageClient />
      )}
    </div>
  );
}
