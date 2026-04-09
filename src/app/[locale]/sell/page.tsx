import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Dac7BlockedAlert } from '@/components/dac7/Dac7BlockedAlert';
import { SellPageClient } from './_components/SellPageClient';

export const metadata: Metadata = {
  title: 'Sell a game',
};

export default async function SellPage() {
  const { profile } = await requireServerAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Create a listing
      </h1>
      {profile?.dac7_status === 'blocked' ? <Dac7BlockedAlert /> : <SellPageClient />}
    </div>
  );
}
