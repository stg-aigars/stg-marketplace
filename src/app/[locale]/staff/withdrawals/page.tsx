import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import type { WithdrawalStatus } from '@/lib/wallet/types';
import { WithdrawalActions } from './WithdrawalActions';

export const metadata: Metadata = {
  title: 'Withdrawals — Staff',
};

interface WithdrawalRow {
  id: string;
  amount_cents: number;
  status: WithdrawalStatus;
  bank_account_holder: string;
  bank_iban: string;
  staff_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  user_profiles: { full_name: string | null; email: string | null } | null;
}

const STATUS_BADGE: Record<WithdrawalStatus, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  approved: 'default',
  completed: 'success',
  rejected: 'error',
};

export default async function StaffWithdrawalsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { serviceClient } = await requireServerAuth();

  let query = serviceClient
    .from('withdrawal_requests')
    .select('*, user_profiles!withdrawal_requests_user_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  }

  const { data: withdrawals } = await query;
  const typedWithdrawals = (withdrawals ?? []) as WithdrawalRow[];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-4">
        Withdrawal requests
      </h1>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'All', value: '' },
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Completed', value: 'completed' },
          { label: 'Rejected', value: 'rejected' },
        ].map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/staff/withdrawals?status=${filter.value}` : '/staff/withdrawals'}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              (searchParams.status ?? '') === filter.value
                ? 'bg-semantic-primary text-semantic-text-inverse border-semantic-primary'
                : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {typedWithdrawals.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-semantic-text-muted text-center py-8">No withdrawal requests found.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {typedWithdrawals.map((w) => (
            <Card key={w.id}>
              <CardBody className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={STATUS_BADGE[w.status] ?? 'default'}>
                        {w.status}
                      </Badge>
                      <span className="text-xs text-semantic-text-muted">
                        {formatDate(w.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-semantic-text-heading font-medium">
                      {w.user_profiles?.full_name ?? 'Unknown user'}{' '}
                      <span className="text-semantic-text-muted font-normal">
                        ({w.user_profiles?.email ?? '—'})
                      </span>
                    </p>
                    <p className="text-sm text-semantic-text-secondary mt-1">
                      {w.bank_account_holder} · {w.bank_iban}
                    </p>
                    {w.staff_notes && (
                      <p className="text-xs text-semantic-text-muted mt-1">
                        Note: {w.staff_notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-semantic-text-heading">
                      {formatCentsToCurrency(w.amount_cents)}
                    </p>
                    {(w.status === 'pending' || w.status === 'approved') && (
                      <div className="mt-2">
                        <WithdrawalActions
                          withdrawalId={w.id}
                          currentStatus={w.status}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
