import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import { logAuditEvent } from '@/lib/services/audit';
import {
  Badge,
  BackLink,
  Card,
  CardBody,
  EmptyState,
  Input,
  Button,
} from '@/components/ui';
import { formatDateTime } from '@/lib/date-utils';
import { ShieldWarning } from '@phosphor-icons/react/ssr';

export const metadata: Metadata = {
  title: 'Suspicious activity — Staff',
};

interface SuspiciousRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  login_count: number;
  distinct_ip_count: number;
  distinct_country_count: number;
  countries: string[] | null;
}

interface RecentLoginRow {
  id: string;
  user_id: string;
  ip_address: string | null;
  country: string | null;
  user_agent: string | null;
  created_at: string;
}

const DEFAULT_DAYS = 7;
const DEFAULT_MIN_IPS = 5;

export default async function StaffSuspiciousActivityPage(
  props: { searchParams: Promise<{ days?: string; min_ips?: string; user_id?: string }> }
) {
  const searchParams = await props.searchParams;
  const { serviceClient, user } = await requireServerAuth();

  const days = clampInt(searchParams.days, DEFAULT_DAYS, 1, 30);
  const minIps = clampInt(searchParams.min_ips, DEFAULT_MIN_IPS, 2, 100);
  // UUID validation guards against malformed inputs reaching the DB query
  // (the inet column would error gracefully but the focused-user empty
  // state would mask that to staff). Strict UUID v4-ish shape check.
  const rawFocus = searchParams.user_id?.trim() || null;
  const focusedUserId = rawFocus && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(rawFocus)
    ? rawFocus
    : null;

  // Audit-trail the staff drill-in. The ROPA balancing test for this
  // surface claims staff reads are logged — this is the emission that
  // backs that claim. Operational retention is sufficient (the artifact
  // proves access happened; the originating signal data is in
  // login_activity itself with its own retention).
  if (focusedUserId) {
    void logAuditEvent({
      actorId: user.id,
      actorType: 'user',
      action: 'login_activity.staff_viewed',
      resourceType: 'user',
      resourceId: focusedUserId,
      retentionClass: 'operational',
    });
  }

  // Suspicious-pattern flagger (RPC) — service-role only, gated by the
  // staff-only staff/layout.tsx wrapper that runs requireServerAuth.
  const { data: suspiciousData, error: suspiciousError } = await serviceClient.rpc(
    'get_suspicious_login_activity',
    { p_days: days, p_min_unique_ips: minIps },
  );
  const suspicious = (suspiciousData ?? []) as SuspiciousRow[];

  // If staff is drilling into a specific user, fetch their recent activity.
  let focusedRows: RecentLoginRow[] = [];
  let focusedProfile: { full_name: string | null; email: string | null } | null = null;
  if (focusedUserId) {
    const [{ data: profile }, { data: rows }] = await Promise.all([
      serviceClient.from('user_profiles').select('full_name, email').eq('id', focusedUserId).maybeSingle<{ full_name: string | null; email: string | null }>(),
      serviceClient
        .from('login_activity')
        .select('id, user_id, ip_address, country, user_agent, created_at')
        .eq('user_id', focusedUserId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    focusedProfile = profile ?? null;
    focusedRows = (rows ?? []) as RecentLoginRow[];
  }

  return (
    <div>
      <BackLink href="/staff/audit" label="Audit log" />

      <div className="flex items-center gap-3 mt-4 mb-4">
        <ShieldWarning size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Suspicious login activity
        </h1>
      </div>

      <p className="text-sm text-semantic-text-secondary mb-6 max-w-2xl">
        Users whose recent login pattern crosses the unique-IP threshold —
        useful for spotting account-takeover (login from many places at once)
        and multi-account abuse (one IP behind many accounts). Data retained
        30 days; older rows are auto-deleted.
      </p>

      {/* Threshold filters */}
      <Card className="mb-6">
        <CardBody>
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <Input
              type="number"
              name="days"
              label="Lookback window (days)"
              defaultValue={String(days)}
              min={1}
              max={30}
            />
            <Input
              type="number"
              name="min_ips"
              label="Minimum distinct IPs"
              defaultValue={String(minIps)}
              min={2}
              max={100}
            />
            <Button type="submit" variant="primary">Apply</Button>
          </form>
        </CardBody>
      </Card>

      {suspiciousError && (
        <div className="mb-4 p-4 rounded-lg border border-semantic-error/30 bg-semantic-error/10 text-sm text-semantic-error">
          Failed to query suspicious activity: {suspiciousError.message}
        </div>
      )}

      <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
        Flagged users ({suspicious.length})
      </h2>

      {suspicious.length === 0 ? (
        <EmptyState
          title="No flagged users"
          description="Adjust the thresholds above or wait for activity to accumulate. The suspicious-pattern flagger requires at least the minimum-IP threshold to fire."
        />
      ) : (
        <div className="space-y-2 mb-8">
          {suspicious.map((row) => (
            <Card key={row.user_id}>
              <CardBody>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/staff/users/${row.user_id}`} className="font-medium text-semantic-text-heading link-brand">
                        {row.full_name ?? row.email ?? row.user_id}
                      </Link>
                      <Badge variant="warning">{row.distinct_ip_count} IPs</Badge>
                      {row.distinct_country_count > 1 && (
                        <Badge variant="error">{row.distinct_country_count} countries</Badge>
                      )}
                      <span className="text-xs text-semantic-text-muted">
                        {row.login_count} logins · last {days}d
                      </span>
                    </div>
                    {row.countries && row.countries.length > 0 && (
                      <p className="text-xs text-semantic-text-muted mt-1 font-mono">
                        countries: {row.countries.join(', ')}
                      </p>
                    )}
                  </div>
                  <SelectFocusLink userId={row.user_id} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Drilled-in view for a specific user */}
      {focusedUserId && (
        <div className="border-t border-semantic-border-subtle pt-6">
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Recent activity — {focusedProfile?.full_name ?? focusedProfile?.email ?? focusedUserId}
          </h2>
          {focusedRows.length === 0 ? (
            <EmptyState title="No recorded sessions" description="This user has no login_activity rows in the last 30 days." />
          ) : (
            <Card>
              <CardBody>
                <ol className="space-y-2 text-sm">
                  {focusedRows.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-xs font-mono text-semantic-text-muted shrink-0">
                        {formatDateTime(row.created_at)}
                      </span>
                      <span className="font-mono text-xs text-semantic-text-heading">
                        {row.ip_address ?? '—'}
                      </span>
                      {row.country && <Badge variant="default">{row.country}</Badge>}
                      {row.user_agent && (
                        <span className="text-xs text-semantic-text-muted truncate max-w-[40ch]">
                          {row.user_agent}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function SelectFocusLink({ userId }: { userId: string }) {
  // Build a self-link that preserves the threshold params + adds user_id.
  // We can't read searchParams here, so just use the user_id alone — the
  // caller's existing days/min_ips defaults will re-apply on navigation.
  return (
    <Link
      href={`/staff/audit/security?user_id=${userId}`}
      className="text-xs link-brand shrink-0"
    >
      Drill in
    </Link>
  );
}

