import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Wallet } from '@phosphor-icons/react/ssr';
import { getWalletIntegrity } from '@/lib/accounting/queries';
import { WalletIntegrityCheck } from '@/components/staff/accounting/WalletIntegrityCheck';

export const metadata: Metadata = {
  title: 'Wallet integrity — Staff',
};

/**
 * Server-rendered cross-check between GL account 5351 (seller wallet
 * liability) and the canonical `wallets` table. Reload the page to refresh.
 */
export default async function WalletIntegrityPage() {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const data = await getWalletIntegrity(serviceClient);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Wallet size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Wallet integrity
        </h1>
      </div>
      <p className="text-sm text-semantic-text-secondary max-w-2xl">
        Cross-check GL account{' '}
        <code className="font-mono text-semantic-text-primary">5351</code>{' '}
        (seller wallet liability, credit-normal) against the canonical{' '}
        <code className="font-mono text-semantic-text-primary">wallets</code>{' '}
        table. Under Shape-2 lazy timing (PR C commit 10), the wallet table is
        debited at withdrawal-request time but GL 5351 lags until staff marks
        completion — so the GL/wallet delta legitimately equals the in-flight
        withdrawal total during normal operations. Reconciled when{' '}
        <code className="font-mono text-semantic-text-primary">
          delta === in_flight_withdrawals
        </code>
        . Stale in-flight withdrawals (≥ 7 days) surface as operational
        anomalies for investigation; per-seller mismatches surface in the
        table below.
      </p>

      <WalletIntegrityCheck data={data} />
    </div>
  );
}
