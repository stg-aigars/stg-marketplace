import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getDac7Profile, getDac7Stats } from '@/lib/dac7/service';
import { Dac7Section } from './Dac7Section';

export const metadata: Metadata = {
  title: 'Tax information',
};

export default async function TaxSettingsPage() {
  const { user } = await requireServerAuth();

  const [dac7Profile, stats] = await Promise.all([
    getDac7Profile(user.id),
    getDac7Stats(user.id),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Tax information
      </h1>
      <Dac7Section
        dac7Profile={dac7Profile}
        stats={stats}
      />
    </div>
  );
}
