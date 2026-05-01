import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, SectionLink } from '@/components/ui';
import { ResourceAuditTimeline } from '@/components/staff/ResourceAuditTimeline';
import { formatDate } from '@/lib/date-utils';
import { getCountryName } from '@/lib/country-utils';
import { SellerStatusForm } from './SellerStatusForm';
import type { SellerStatus } from './actions';
import { TraderSignalActions } from './TraderSignalActions';
import type { DismissRationaleCategory } from './trader-signal-actions';
import { TRADER_THRESHOLDS } from '@/lib/seller/trader-thresholds';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDateTime } from '@/lib/date-utils';

export const metadata: Metadata = {
  title: 'User — Staff',
};

// Short labels for the staff display surface. The dismissal form
// (TraderSignalActions) uses longer explanatory labels for selection.
// Type-narrowed against DismissRationaleCategory so a new category in the
// canonical union forces an update here.
const DISMISSAL_CATEGORY_LABEL: Record<DismissRationaleCategory, string> = {
  verified_collector: 'Verified collector',
  low_engagement_pattern: 'Low-engagement pattern',
  marketplace_norm: 'Marketplace norm',
  other: 'Other',
};

// Render-time guard: only allow http(s) URLs in the evidence link.
// Defense-in-depth against javascript: or data: URLs landing in audit metadata
// — staff-to-staff trust boundary is low-severity but cheap to enforce here.
function safeEvidenceUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

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
    .select('id, full_name, email, country, created_at, is_staff, dac7_status, seller_status, completed_sales_12mo_count, completed_sales_12mo_revenue_cents, trader_signal_first_crossed_at, trader_signal_threshold_version, verification_requested_at, verification_response, verification_responded_at, trader_signal_dismissed_at, trader_signal_dismissed_threshold_version')
    .eq('id', id)
    .single();

  if (!profile) {
    notFound();
  }

  // In-flight + active listing counts (used by the suspension UI's warning Alert)
  // + the most recent dismissal audit row (only if the seller has been dismissed).
  // The audit lookup is cheap (indexed on resource_type+resource_id) and lets us
  // surface the rationale inline instead of forcing staff to grep audit_log.
  const [
    { count: activeCount },
    { count: reservedCount },
    { count: auctionEndedCount },
    { data: dismissalAuditRow },
  ] = await Promise.all([
    serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'active'),
    serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'reserved'),
    serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'auction_ended'),
    profile.trader_signal_dismissed_at
      ? serviceClient
          .from('audit_log')
          .select('actor_id, created_at, metadata')
          .eq('action', 'seller.trader_signal_dismissed')
          .eq('resource_type', 'user')
          .eq('resource_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Resolve the dismissing-staff actor name. .maybeSingle() because the actor
  // profile may have been deleted (offboarded staff) — 0 rows is legitimate
  // and shouldn't log a PGRST116 error on every page load.
  let dismissalActorName: string | null = null;
  if (dismissalAuditRow?.actor_id) {
    const { data: actor } = await serviceClient
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', dismissalAuditRow.actor_id)
      .maybeSingle();
    dismissalActorName = actor?.full_name ?? actor?.email ?? null;
  }

  type DismissalRationale = {
    category?: DismissRationaleCategory;
    justification?: string;
    evidenceUrl?: string | null;
  };
  const dismissalMeta = dismissalAuditRow?.metadata as { rationale?: DismissalRationale } | null;
  const dismissalRationale = dismissalMeta?.rationale ?? null;
  const safeEvidence = safeEvidenceUrl(dismissalRationale?.evidenceUrl);

  const sellerStatus = (profile.seller_status as SellerStatus) ?? 'active';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff/notices" className="text-sm link-brand">
          ← Back to staff dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
            {profile.full_name ?? 'Unnamed user'}
          </h1>
          <p className="text-sm text-semantic-text-muted mt-1">
            {profile.email} · {getCountryName(profile.country) || profile.country || '—'} · joined{' '}
            {profile.created_at ? formatDate(profile.created_at) : 'unknown'}
          </p>
        </div>
        <SectionLink href={`/staff/audit?resource_type=user&resource_id=${profile.id}`}>
          Audit log
        </SectionLink>
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
          {profile.trader_signal_dismissed_at && (
            <div className="rounded border border-semantic-border-subtle bg-semantic-bg-elevated p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Dismissed</Badge>
                <span className="text-xs text-semantic-text-muted">
                  {formatDateTime(profile.trader_signal_dismissed_at)}
                  {dismissalActorName ? ` · by ${dismissalActorName}` : ''}
                </span>
              </div>
              {dismissalRationale?.category && (
                <div>
                  <span className="font-semibold">Category:</span> {DISMISSAL_CATEGORY_LABEL[dismissalRationale.category] ?? dismissalRationale.category}
                </div>
              )}
              {dismissalRationale?.justification && (
                <div className="whitespace-pre-wrap break-words">
                  <span className="font-semibold">Justification:</span> {dismissalRationale.justification}
                </div>
              )}
              {safeEvidence && (
                <div>
                  <span className="font-semibold">Evidence:</span>{' '}
                  <a href={safeEvidence} target="_blank" rel="noopener noreferrer" className="link-brand">
                    {safeEvidence}
                  </a>
                </div>
              )}
              {profile.trader_signal_dismissed_threshold_version && profile.trader_signal_dismissed_threshold_version !== TRADER_THRESHOLDS.version && (
                <div className="text-xs text-semantic-warning">
                  Dismissed at threshold version <code>{profile.trader_signal_dismissed_threshold_version}</code>; current is <code>{TRADER_THRESHOLDS.version}</code>. The cron will treat this seller as a fresh review candidate.
                </div>
              )}
            </div>
          )}
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

      <ResourceAuditTimeline
        serviceClient={serviceClient}
        resourceType="user"
        resourceId={profile.id}
        alsoIncludeAsActor={profile.id}
        title="User activity"
      />
    </div>
  );
}
