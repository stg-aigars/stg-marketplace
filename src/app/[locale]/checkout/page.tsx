import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getWalletBalance } from '@/lib/services/wallet';
import { getAllTerminals } from '@/lib/services/unisend/client';
import type { TerminalCountry, TerminalOption } from '@/lib/services/unisend/types';
import { Alert, Breadcrumb } from '@/components/ui';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = {
  title: 'Checkout',
};

const errorMessages: Record<string, string> = {
  payment_failed: 'Payment could not be processed. Please try again.',
  user_cancelled: 'Payment was cancelled. You can try again when ready.',
  card_declined: 'Your card was declined. Please try a different payment method.',
  auth_failed: 'Card authentication failed. Please try again.',
  technical_error: 'A technical error occurred. Please try again in a few minutes.',
  fraud_declined: 'Payment could not be processed. Please try a different payment method.',
  verification_failed: 'Payment verification failed. Please try again.',
  listing_unavailable: 'One or more items were purchased while you were paying. Your payment will be refunded automatically.',
  order_creation_failed: 'Something went wrong creating your order. Your payment will be refunded automatically. If you do not see the refund within a few business days, please contact support.',
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ seller?: string; error?: string }>;
}) {
  const params = await searchParams;
  const seller = params.seller;

  if (!seller) {
    redirect('/cart');
  }

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

  // Fetch terminals, wallet balance, and seller profile in parallel
  let terminals: TerminalOption[] = [];
  let terminalsFetchFailed = false;

  const [terminalsResult, walletBalanceCents, sellerProfileResult] = await Promise.all([
    getAllTerminals().catch(() => {
      terminalsFetchFailed = true;
      return [];
    }),
    getWalletBalance(user.id),
    (async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const client = await createClient();
      const { data } = await client
        .from('public_profiles')
        .select('id, full_name, avatar_url, country')
        .eq('id', seller)
        .single<{ id: string; full_name: string | null; avatar_url: string | null; country: string | null }>();
      return data;
    })(),
  ]);

  terminals = terminalsResult.map((t) => ({
    id: t.id, name: t.name, city: t.city, address: t.address,
    postalCode: t.postalCode, countryCode: t.countryCode,
    latitude: t.latitude, longitude: t.longitude,
  }));

  const errorMessage = params.error ? errorMessages[params.error] ?? 'Something went wrong. Please try again.' : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Breadcrumb
        items={[
          { label: 'Cart', href: '/cart' },
          { label: 'Checkout' },
        ]}
      />

      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mt-4 mb-6">
        Checkout
      </h1>

      {errorMessage && (
        <Alert variant="error" className="mb-6">{errorMessage}</Alert>
      )}

      <CheckoutForm
        buyerCountry={buyerCountry}
        buyerPhone={profile.phone ?? ''}
        terminals={terminals}
        terminalsFetchFailed={terminalsFetchFailed}
        walletBalanceCents={walletBalanceCents}
        sellerFilter={seller}
        sellerProfile={sellerProfileResult ? {
          id: sellerProfileResult.id,
          name: sellerProfileResult.full_name ?? 'Seller',
          avatarUrl: sellerProfileResult.avatar_url,
          country: sellerProfileResult.country,
        } : null}
      />
    </div>
  );
}
