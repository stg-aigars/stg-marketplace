import { requireServerAuth } from '@/lib/auth/helpers';
import { SellPageClient } from './_components/SellPageClient';

export default async function SellPage() {
  await requireServerAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Create a listing
      </h1>
      <SellPageClient />
    </div>
  );
}
