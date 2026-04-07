import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getWalletBalance } from '@/lib/services/wallet';
import { getAllTerminals } from '@/lib/services/unisend/client';
import type { TerminalCountry, TerminalOption } from '@/lib/services/unisend/types';
import Link from 'next/link';
import { Breadcrumb } from '@/components/ui';
import { CartCheckoutForm } from './CartCheckoutForm';

export const metadata: Metadata = {
  title: 'Cart Checkout',
};

export default async function CartCheckoutPage() {
  const { user, profile } = await requireServerAuth();

  if (!profile?.country) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-semantic-text-secondary">
          Please set your country in your <Link href="/account/settings" className="underline">account settings</Link> before checking out.
        </p>
      </div>
    );
  }

  const buyerCountry = profile.country as TerminalCountry;

  // Fetch terminals and wallet balance in parallel
  let terminals: TerminalOption[] = [];
  let terminalsFetchFailed = false;
  let walletBalanceCents = 0;

  const [terminalsResult, walletBalance] = await Promise.all([
    getAllTerminals().catch(() => {
      terminalsFetchFailed = true;
      return [];
    }),
    getWalletBalance(user.id),
  ]);

  terminals = terminalsResult.map((t) => ({
    id: t.id, name: t.name, city: t.city, address: t.address,
    postalCode: t.postalCode, countryCode: t.countryCode,
    latitude: t.latitude, longitude: t.longitude,
  }));
  walletBalanceCents = walletBalance;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Breadcrumb
        items={[
          { label: 'Cart', href: '/cart' },
          { label: 'Checkout' },
        ]}
      />

      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mt-4 mb-6">
        Checkout
      </h1>

      <CartCheckoutForm
        buyerCountry={buyerCountry}
        buyerPhone={profile.phone ?? ''}
        terminals={terminals}
        terminalsFetchFailed={terminalsFetchFailed}
        walletBalanceCents={walletBalanceCents}
      />
    </div>
  );
}
