'use client';

import { useState } from 'react';
import { Button, Badge, Card, CardBody } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import type { WalletTransactionRow } from '@/lib/wallet/types';
import { CopyReferenceButton } from './CopyReferenceButton';

const TYPE_LABELS: Record<string, string> = {
  credit: 'Credit',
  debit: 'Payment',
  withdrawal: 'Withdrawal',
};

const TYPE_BADGE_VARIANT: Record<string, 'success' | 'default' | 'warning'> = {
  credit: 'success',
  debit: 'default',
  withdrawal: 'warning',
};

interface TransactionListProps {
  initialTransactions: WalletTransactionRow[];
  initialTotal: number;
  withdrawalReferences?: Record<string, string>;
}

export function TransactionList({
  initialTransactions,
  initialTotal,
  withdrawalReferences = {},
}: TransactionListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 20;
  const hasMore = transactions.length < total;

  async function loadMore() {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await apiFetch(`/api/wallet/transactions?page=${nextPage}&limit=${limit}`);
      if (!res.ok) return;
      const data = await res.json();
      setTransactions((prev) => [...prev, ...data.transactions]);
      setTotal(data.total);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {transactions.map((txn) => {
        const reference = txn.withdrawal_id ? withdrawalReferences[txn.withdrawal_id] : undefined;
        return (
          <Card key={txn.id}>
            <CardBody className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={TYPE_BADGE_VARIANT[txn.type] ?? 'default'}>
                      {TYPE_LABELS[txn.type] ?? txn.type}
                    </Badge>
                    <span className="text-xs text-semantic-text-muted">
                      {formatDate(txn.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-semantic-text-secondary mt-1 truncate">
                    {txn.description}
                  </p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className={`font-semibold ${txn.type === 'credit' ? 'text-semantic-success' : 'text-semantic-text-primary'}`}>
                    {txn.type === 'credit' ? '+' : '-'}{formatCentsToCurrency(txn.amount_cents)}
                  </p>
                  <p className="text-xs text-semantic-text-muted">
                    Balance: {formatCentsToCurrency(txn.balance_after_cents)}
                  </p>
                </div>
              </div>
              {reference && (
                <div className="mt-2 pt-2 border-t border-semantic-border flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-semantic-text-muted">Reference </span>
                    <code className="text-xs font-semibold text-semantic-text-heading">
                      {reference}
                    </code>
                  </div>
                  <CopyReferenceButton value={reference} />
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}

      {hasMore && (
        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" loading={loading} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
