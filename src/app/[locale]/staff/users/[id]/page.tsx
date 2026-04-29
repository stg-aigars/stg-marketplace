import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { getCountryName } from '@/lib/country-utils';
import { SellerStatusForm } from './SellerStatusForm';
import type { SellerStatus } from './actions';

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
    .select('id, full_name, email, country, created_at, is_staff, dac7_status, seller_status')
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
