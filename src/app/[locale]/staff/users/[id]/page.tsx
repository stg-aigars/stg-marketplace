import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { getCountryName } from '@/lib/country-utils';
import { SellerStatusForm } from './SellerStatusForm';
import type { SellerStatus } from './actions';
import { TraderSignalActions } from './TraderSignalActions';
import { TRADER_THRESHOLDS } from '@/lib/seller/trader-thresholds';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';

export const metadata: Metadata = {
  title: 'User — Staff',
};

interface UserPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function StaffUserPage({ params }: UserPageProps) {
  const { id } = await params;
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('id, full_name, email, country, created_at, is_staff, dac7_status, seller_status, completed_sales_12mo_count, completed_sales_12mo_revenue_cents, trader_signal_first_crossed_at, trader_signal_threshold_version, verification_requested_at, verification_response, verification_responded_at')
    .eq('id', id)
    .single();

  if (!profile) {
    notFound();
  }

  // In-flight + active listing counts (used by the suspension UI's warning Alert)
  const [{ count: activeCount }, { count: reservedCount }, { count: auctionEndedCount }] = await Promise.all([
    serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'active'),
    serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'reserved'),
    serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'auction_ended'),
  ]);

  const sellerStatus = (profile.seller_status as SellerStatus) ?? 'active';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff/notices" className="text-sm link-brand">
          ← Back to staff dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          {profile.full_name ?? 'Unnamed user'}
        </h1>
        <p className="text-sm text-semantic-text-muted mt-1">
          {profile.email} · {getCountryName(profile.country) || profile.country || '—'} · joined{' '}
          {profile.created_at ? formatDate(profile.created_at) : 'unknown'}
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-base font-semibold text-semantic-text-heading">Current state</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant={profile.is_staff ? 'trust' : 'default'}>
              {profile.is_staff ? 'Staff' : 'Regular user'}
            </Badge>
            <Badge variant={sellerStatus === 'suspended' ? 'error' : sellerStatus === 'warned' ? 'warning' : 'default'}>
              Seller status: {sellerStatus}
            </Badge>
            <Badge variant="default">DAC7: {profile.dac7_status ?? 'none'}</Badge>
            <Badge variant="default">Active listings: {activeCount ?? 0}</Badge>
            <Badge variant="default">In-flight: {(reservedCount ?? 0) + (auctionEndedCount ?? 0)}</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-base font-semibold text-semantic-text-heading">Trader-volume signal</h2>
          <div className="text-sm text-semantic-text-secondary space-y-1">
            <div>
              <span className="font-semibold">Rolling 12-month sales:</span>{' '}
              <span className={(profile.completed_sales_12mo_count ?? 0) >= TRADER_THRESHOLDS.verificationTrigger.salesCount ? 'text-semantic-warning font-semibold' : ''}>
                {profile.completed_sales_12mo_count ?? 0}
              </span>{' '}
              <span className="text-xs text-semantic-text-muted">
                (verification trigger: {TRADER_THRESHOLDS.verificationTrigger.salesCount})
              </span>
            </div>
            <div>
              <span className="font-semibold">Rolling 12-month revenue:</span>{' '}
              <span className={(profile.completed_sales_12mo_revenue_cents ?? 0) >= TRADER_THRESHOLDS.verificationTrigger.revenueCents ? 'text-semantic-warning font-semibold' : ''}>
                {formatCentsToCurrency(profile.completed_sales_12mo_revenue_cents ?? 0)}
              </span>{' '}
              <span className="text-xs text-semantic-text-muted">
                (verification trigger: {formatCentsToCurrency(TRADER_THRESHOLDS.verificationTrigger.revenueCents)})
              </span>
            </div>
            <div>
              <span className="font-semibold">Signal first crossed:</span>{' '}
              {profile.trader_signal_first_crossed_at
                ? formatDateTime(profile.trader_signal_first_crossed_at)
                : '—'}
            </div>
            <div>
              <span className="font-semibold">Verification:</span>{' '}
              {!profile.verification_requested_at
                ? 'not yet requested'
                : profile.verification_response
                  ? `responded ${profile.verification_responded_at ? formatDateTime(profile.verification_responded_at) : ''} → ${profile.verification_response}`
                  : `sent ${formatDateTime(profile.verification_requested_at)}, awaiting response`}
            </div>
          </div>
          <p className="text-xs text-semantic-text-muted">
            Advisory at launch — counters surface here but never auto-mutate seller_status. See{' '}
            <code>docs/legal_audit/trader-detection-deferral.md</code> for the lawyer&apos;s framework.
          </p>
          <TraderSignalActions
            userId={profile.id}
            signalCrossedAt={profile.trader_signal_first_crossed_at ?? null}
            verificationRequestedAt={profile.verification_requested_at ?? null}
            verificationResponse={(profile.verification_response as 'collector' | 'trader' | 'unresponsive' | null) ?? null}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-base font-semibold text-semantic-text-heading">Change seller status</h2>
          <p className="text-sm text-semantic-text-muted">
            Suspension blocks new listings (gated server-side in <code>createListing</code>) and
            pauses live <code>active</code> listings via the <code>trg_pause_listings_on_suspension</code> trigger.
            <code> reserved</code> and <code>auction_ended</code> listings are intentionally not paused so in-flight
            transactions complete. Un-suspension does not auto-unpause — the seller must re-list.
          </p>
          <SellerStatusForm
            userId={profile.id}
            currentStatus={sellerStatus}
            reservedCount={reservedCount ?? 0}
            auctionEndedCount={auctionEndedCount ?? 0}
            activeCount={activeCount ?? 0}
          />
        </CardBody>
      </Card>
    </div>
  );
}
