import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/helpers';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Select,
} from '@/components/ui';
import { fetchProfiles } from '@/lib/supabase/helpers';
import { formatDateTime } from '@/lib/date-utils';
import { ListMagnifyingGlass } from '@phosphor-icons/react/ssr';

export const metadata: Metadata = {
  title: 'Audit Log — Staff',
};

type ActorType = 'user' | 'system' | 'cron';
type RetentionClass = 'operational' | 'regulatory';

interface AuditLogRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_type: ActorType;
  action: string;
  resource_type: string;
  resource_id: string | null;
  retention_class: RetentionClass;
  metadata: Record<string, unknown> | null;
}

const PAGE_SIZE = 50;

const ACTOR_TYPE_OPTIONS = [
  { value: '', label: 'Any actor type' },
  { value: 'user', label: 'User (staff or platform user)' },
  { value: 'system', label: 'System' },
  { value: 'cron', label: 'Cron' },
];

const RETENTION_CLASS_OPTIONS = [
  { value: '', label: 'Any retention' },
  { value: 'regulatory', label: 'Regulatory (10y)' },
  { value: 'operational', label: 'Operational (30d)' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Any resource type' },
  { value: 'order', label: 'Order' },
  { value: 'dispute', label: 'Dispute' },
  { value: 'dsa_notice', label: 'DSA notice' },
  { value: 'listing', label: 'Listing' },
  { value: 'user', label: 'User' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'shipment', label: 'Shipment' },
  { value: 'order_message', label: 'Order message' },
  { value: 'comment', label: 'Listing comment' },
  { value: 'oss_submission', label: 'OSS submission' },
  { value: 'terms', label: 'Terms acceptance' },
  { value: 'seller_terms', label: 'Seller terms acceptance' },
  { value: 'privacy', label: 'Privacy acknowledgement' },
];

/** Map a (resource_type, resource_id) pair to a staff detail page if one exists. */
function resourceDetailHref(resourceType: string, resourceId: string | null): string | null {
  if (!resourceId) return null;
  switch (resourceType) {
    case 'order':
      return `/staff/orders/${resourceId}`;
    case 'dispute':
      return `/staff/disputes/${resourceId}`;
    case 'user':
      return `/staff/users/${resourceId}`;
    case 'listing':
      return `/listings/${resourceId}`;
    default:
      return null;
  }
}

interface SearchParams {
  actor_type?: string;
  actor_id?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  retention_class?: string;
  date_from?: string;
  date_to?: string;
  page?: string;
}

export default async function StaffAuditPage(
  props: { searchParams: Promise<SearchParams> }
) {
  const searchParams = await props.searchParams;
  const { serviceClient } = await requireServerAuth();

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = serviceClient
    .from('audit_log')
    .select(
      'id, created_at, actor_id, actor_type, action, resource_type, resource_id, retention_class, metadata',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.actor_type && ['user', 'system', 'cron'].includes(searchParams.actor_type)) {
    query = query.eq('actor_type', searchParams.actor_type);
  }
  if (searchParams.actor_id) {
    query = query.eq('actor_id', searchParams.actor_id);
  }
  if (searchParams.action) {
    // Substring match — escape SQL wildcards in user input (% _) per CLAUDE.md ILIKE rule.
    const escaped = searchParams.action.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.ilike('action', `%${escaped}%`);
  }
  if (searchParams.resource_type) {
    query = query.eq('resource_type', searchParams.resource_type);
  }
  if (searchParams.resource_id) {
    query = query.eq('resource_id', searchParams.resource_id);
  }
  if (searchParams.retention_class && ['operational', 'regulatory'].includes(searchParams.retention_class)) {
    query = query.eq('retention_class', searchParams.retention_class);
  }
  if (searchParams.date_from) {
    query = query.gte('created_at', searchParams.date_from);
  }
  if (searchParams.date_to) {
    // Treat date_to as end-of-day inclusive
    query = query.lte('created_at', `${searchParams.date_to}T23:59:59.999Z`);
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as AuditLogRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Resolve actor names for `actor_type='user'` rows
  const userActorIds = Array.from(
    new Set(
      rows
        .filter((r) => r.actor_type === 'user' && r.actor_id)
        .map((r) => r.actor_id as string)
    )
  );
  const profileMap = userActorIds.length > 0
    ? await fetchProfiles(serviceClient, userActorIds)
    : new Map();

  // Build URL for pagination links — preserve all current filters
  const buildUrl = (newPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
    if (newPage > 1) params.set('page', String(newPage));
    const qs = params.toString();
    return qs ? `/staff/audit?${qs}` : '/staff/audit';
  };

  const hasFilters = Object.entries(searchParams).some(
    ([key, value]) => key !== 'page' && Boolean(value)
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <ListMagnifyingGlass size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Audit log
        </h1>
      </div>

      <p className="text-sm text-semantic-text-secondary mb-6 max-w-2xl">
        Read-only query surface over <code className="font-mono text-xs">audit_log</code>.
        Use this for compliance investigations (DSAR responses, regulator inquiries),
        debugging staff actions, and reconstructing event chains. Regulatory rows are
        retained for 10 years; operational rows for 30 days.
      </p>

      {/* Filter form — native HTML GET form, no client JS needed */}
      <Card className="mb-6">
        <CardBody>
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select
              name="actor_type"
              label="Actor type"
              options={ACTOR_TYPE_OPTIONS}
              defaultValue={searchParams.actor_type ?? ''}
            />
            <Input
              name="actor_id"
              label="Actor ID (UUID)"
              defaultValue={searchParams.actor_id ?? ''}
              placeholder="e.g. b3a2f1c4-..."
            />
            <Input
              name="action"
              label="Action contains"
              defaultValue={searchParams.action ?? ''}
              placeholder="e.g. order.refunded"
            />
            <Select
              name="resource_type"
              label="Resource type"
              options={RESOURCE_TYPE_OPTIONS}
              defaultValue={searchParams.resource_type ?? ''}
            />
            <Input
              name="resource_id"
              label="Resource ID"
              defaultValue={searchParams.resource_id ?? ''}
              placeholder="UUID or string"
            />
            <Select
              name="retention_class"
              label="Retention"
              options={RETENTION_CLASS_OPTIONS}
              defaultValue={searchParams.retention_class ?? ''}
            />
            <Input
              type="date"
              name="date_from"
              label="From date"
              defaultValue={searchParams.date_from ?? ''}
            />
            <Input
              type="date"
              name="date_to"
              label="To date"
              defaultValue={searchParams.date_to ?? ''}
            />
            <div className="flex items-end gap-2">
              <Button type="submit" variant="primary" className="flex-1">
                Filter
              </Button>
              {hasFilters && (
                <Button variant="ghost" asChild>
                  <Link href="/staff/audit">Reset</Link>
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      {error && (
        <div className="mb-4 p-4 rounded-lg border border-semantic-error/30 bg-semantic-error/10 text-sm text-semantic-error">
          Failed to load audit log: {error.message}
        </div>
      )}

      <p className="text-sm text-semantic-text-muted mb-3">
        {total === 0
          ? 'No matching events.'
          : `${total.toLocaleString('en')} event${total === 1 ? '' : 's'} · page ${page} of ${totalPages}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState title="No audit events" description="Adjust filters above or remove date constraints." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const actor = row.actor_id ? profileMap.get(row.actor_id) : null;
            const resourceHref = resourceDetailHref(row.resource_type, row.resource_id);
            return (
              <Card key={row.id}>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-xs text-semantic-text-muted font-mono">
                      {formatDateTime(row.created_at)}
                    </span>
                    <Badge variant={row.retention_class === 'regulatory' ? 'trust' : 'default'}>
                      {row.retention_class}
                    </Badge>
                    <span className="font-mono text-sm text-semantic-text-heading">
                      {row.action}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-semantic-text-muted">Actor: </span>
                      {row.actor_type === 'user' ? (
                        actor ? (
                          <Link
                            href={`/staff/users/${row.actor_id}`}
                            className="text-semantic-brand sm:hover:underline"
                          >
                            {actor.full_name ?? actor.email ?? row.actor_id}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs">{row.actor_id ?? 'user'}</span>
                        )
                      ) : (
                        <span className="capitalize">{row.actor_type}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-semantic-text-muted">Resource: </span>
                      <span className="text-semantic-text-primary">{row.resource_type}</span>
                      {row.resource_id && (
                        <>
                          {' / '}
                          {resourceHref ? (
                            <Link
                              href={resourceHref}
                              className="font-mono text-xs text-semantic-brand sm:hover:underline"
                            >
                              {row.resource_id}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs">{row.resource_id}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {row.metadata && Object.keys(row.metadata).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-semantic-text-muted sm:hover:text-semantic-text-secondary">
                        Metadata
                      </summary>
                      <pre className="mt-2 p-3 rounded bg-semantic-bg-subtle text-semantic-text-secondary overflow-x-auto">
{JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between mt-6">
          <p className="text-sm text-semantic-text-secondary">
            Showing {from + 1}–{Math.min(to + 1, total)} of {total.toLocaleString('en')}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={buildUrl(page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled>Previous</Button>
            )}
            <span className="text-sm text-semantic-text-muted px-2">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={buildUrl(page + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled>Next</Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
