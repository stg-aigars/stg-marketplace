import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, NavTabs, EmptyState } from '@/components/ui';
import { Wallet } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import type { WithdrawalStatus } from '@/lib/wallet/types';
import { WithdrawalActions } from './WithdrawalActions';
import { SepaRemittanceGuidance } from './SepaRemittanceGuidance';

export const metadata: Metadata = {
  title: 'Withdrawals — Staff',
};

interface WithdrawalRow {
  id: string;
  amount_cents: number;
  status: WithdrawalStatus;
  reference_number: string;
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

export default async function StaffWithdrawalsPage(
  props: {
    searchParams: Promise<{ status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Withdrawal requests
        </h1>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Approve, reject, or mark complete. SEPA remittance guidance is shown alongside each pending withdrawal.
        </p>
      </div>

      <NavTabs
        tabs={[
          { key: '', label: 'All', href: '/staff/withdrawals' },
          { key: 'pending', label: 'Pending', href: '/staff/withdrawals?status=pending' },
          { key: 'approved', label: 'Approved', href: '/staff/withdrawals?status=approved' },
          { key: 'completed', label: 'Completed', href: '/staff/withdrawals?status=completed' },
          { key: 'rejected', label: 'Rejected', href: '/staff/withdrawals?status=rejected' },
        ]}
        activeTab={searchParams.status ?? ''}
        variant="pill"
        className="mb-6"
      />

      {typedWithdrawals.length === 0 ? (
        <EmptyState icon={Wallet} title="No withdrawal requests found" />
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
                      <code className="text-xs font-semibold text-semantic-text-heading">
                        {w.reference_number}
                      </code>
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
                {w.status === 'approved' && (
                  <SepaRemittanceGuidance reference={w.reference_number} />
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
