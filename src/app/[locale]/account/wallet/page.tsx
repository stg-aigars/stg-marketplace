import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getWalletBalance, getTransactionHistory } from '@/lib/services/wallet';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { Card, CardBody } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { TransactionList } from './TransactionList';
import { WithdrawalForm } from './WithdrawalForm';

export const metadata: Metadata = {
  title: 'Wallet',
};

export default async function WalletPage() {
  const { user } = await requireServerAuth();

  // User-scoped SSR client — RLS policy "Users and staff can view withdrawals"
  // (migration 059) already restricts reads to the caller's own rows.
  const supabase = await createClient();

  const [balanceCents, { transactions, total }, { data: withdrawalRefs }] = await Promise.all([
    getWalletBalance(user.id),
    getTransactionHistory(user.id, 1, 20),
    supabase
      .from('withdrawal_requests')
      .select('id, reference_number')
      .eq('user_id', user.id),
  ]);

  const withdrawalReferenceMap: Record<string, string> = {};
  for (const row of withdrawalRefs ?? []) {
    if (row.id && row.reference_number) {
      withdrawalReferenceMap[row.id] = row.reference_number;
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Wallet
      </h1>

      {/* Balance card */}
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-sm text-semantic-text-muted mb-1">Available balance</p>
          <p className="text-4xl font-bold text-semantic-text-heading">
            {formatCentsToCurrency(balanceCents)}
          </p>
          {balanceCents > 0 && (
            <div className="mt-4">
              <WithdrawalForm balanceCents={balanceCents} />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Transaction history */}
      <div className="mt-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading mb-4">
          Transaction history
        </h2>
        {transactions.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-semantic-text-muted text-center py-8">
                No transactions yet. Your wallet will be credited when buyers confirm orders.
              </p>
            </CardBody>
          </Card>
        ) : (
          <TransactionList
            initialTransactions={transactions}
            initialTotal={total}
            withdrawalReferences={withdrawalReferenceMap}
          />
        )}
      </div>
    </div>
  );
}
