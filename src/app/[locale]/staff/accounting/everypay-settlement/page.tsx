import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bank } from '@phosphor-icons/react/ssr';
import { requireServerAuth } from '@/lib/auth/helpers';
import { EverypaySettlementForm } from '@/components/staff/accounting/EverypaySettlementForm';

export const metadata: Metadata = {
  title: 'Record EveryPay settlement — Staff',
};

/**
 * Staff page for recording an EveryPay daily settlement. Fires a C.3 entry
 * (Dr 2610 Swedbank / Cr 2630 EveryPay clearing) via the server action.
 *
 * Operational cadence: staff records one C.3 per Swedbank settlement that
 * lands. Without this, the 2630 EveryPay clearing account accumulates from
 * C.1 card-cart receipts post-cutover and item 7 of the period-close
 * checklist fails. Card-rail cutover runbook (commit 14) sequences when
 * this gets exercised.
 */
export default async function EverypaySettlementPage() {
  const { isStaff } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Bank size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Record EveryPay settlement
        </h1>
      </div>

      <p className="text-sm text-semantic-text-secondary max-w-2xl">
        Fire a C.3 journal entry (Dr{' '}
        <code className="font-mono text-semantic-text-primary">2610</code>{' '}
        Swedbank / Cr{' '}
        <code className="font-mono text-semantic-text-primary">2630</code>{' '}
        EveryPay clearing) to drain the EveryPay clearing balance against an
        actual Swedbank settlement. Use the bank statement reference from the
        Swedbank inbound credit as the idempotency key — re-submitting the
        same reference returns &ldquo;already recorded&rdquo; without creating
        a duplicate entry.
      </p>

      <EverypaySettlementForm />
    </div>
  );
}
