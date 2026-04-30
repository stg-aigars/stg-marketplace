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
  Pagination,
  SectionLink,
  Select,
} from '@/components/ui';
import { fetchProfiles, type Profile } from '@/lib/supabase/helpers';
import { formatDateTime } from '@/lib/date-utils';
import { ListMagnifyingGlass, FileMagnifyingGlass } from '@phosphor-icons/react/ssr';

export const metadata: Metadata = {
  title: 'Audit Log — Staff',
};

const ACTOR_TYPES = ['user', 'system', 'cron'] as const;
const RETENTION_CLASSES = ['operational', 'regulatory'] as const;
type ActorType = typeof ACTOR_TYPES[number];
type RetentionClass = typeof RETENTION_CLASSES[number];

function isActorType(value: string | undefined): value is ActorType {
  return !!value && (ACTOR_TYPES as readonly string[]).includes(value);
}
function isRetentionClass(value: string | undefined): value is RetentionClass {
  return !!value && (RETENTION_CLASSES as readonly string[]).includes(value);
}

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
  /** 'cards' (default — friendly long-form view) or 'table' (compact, scan
   *  many events fast for compliance investigations). Persisted in the URL
   *  so it survives filter changes within the same session. */
  view?: string;
}

export default async function StaffAuditPage(
  props: { searchParams: Promise<SearchParams> }
) {
  const searchParams = await props.searchParams;
  const { serviceClient } = await requireServerAuth();

  const requestedPage = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const view: 'cards' | 'table' = searchParams.view === 'table' ? 'table' : 'cards';

  // Builder factory — Supabase query builders mutate in place and return
  // `this`, so a single instance can't be reused for two range() calls.
  // Constructing fresh builders also keeps the filter wiring obviously
  // free of cross-query state.
  const buildQuery = () => {
    let q = serviceClient
      .from('audit_log')
      .select(
        'id, created_at, actor_id, actor_type, action, resource_type, resource_id, retention_class, metadata',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (isActorType(searchParams.actor_type)) {
      q = q.eq('actor_type', searchParams.actor_type);
    }
    if (searchParams.actor_id) {
      q = q.eq('actor_id', searchParams.actor_id);
    }
    if (searchParams.action) {
      // Wildcard escape for PostgREST `.ilike()` — uses Postgres' default
      // `\` escape character. NOT the `!` ESCAPE convention used in
      // raw-SQL ILIKE inside RPC functions (see migration 046), which
      // exists because `standard_conforming_strings` makes `\` ambiguous
      // in PL/pgSQL string literals. The `.ilike()` call here goes through
      // the PostgREST query string and uses the LIKE default escape.
      const escaped = searchParams.action.replace(/[%_]/g, (c) => `\\${c}`);
      q = q.ilike('action', `%${escaped}%`);
    }
    if (searchParams.resource_type) {
      q = q.eq('resource_type', searchParams.resource_type);
    }
    if (searchParams.resource_id) {
      q = q.eq('resource_id', searchParams.resource_id);
    }
    if (isRetentionClass(searchParams.retention_class)) {
      q = q.eq('retention_class', searchParams.retention_class);
    }
    if (searchParams.date_from) {
      q = q.gte('created_at', searchParams.date_from);
    }
    if (searchParams.date_to) {
      q = q.lte('created_at', `${searchParams.date_to}T23:59:59.999Z`);
    }
    return q;
  };

  const fromInitial = (requestedPage - 1) * PAGE_SIZE;
  const toInitial = fromInitial + PAGE_SIZE - 1;
  const { data: initialData, count, error } = await buildQuery().range(fromInitial, toInitial);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp so out-of-range URLs (e.g. ?page=999) display the last page rather
  // than "page 999 of 3" with empty rows.
  const page = Math.min(requestedPage, totalPages);

  let rows: AuditLogRow[];
  if (page === requestedPage) {
    rows = (initialData ?? []) as AuditLogRow[];
  } else {
    const from = (page - 1) * PAGE_SIZE;
    const { data: clampedData } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    rows = (clampedData ?? []) as AuditLogRow[];
  }

  const userActorIds = Array.from(
    new Set(
      rows
        .filter((r) => r.actor_type === 'user' && r.actor_id)
        .map((r) => r.actor_id as string)
    )
  );
  const profileMap: Map<string, Profile> = userActorIds.length > 0
    ? await fetchProfiles(serviceClient, userActorIds)
    : new Map();

  const buildUrl = (newPage: number, overrides: Partial<SearchParams> = {}) => {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
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
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <ListMagnifyingGlass size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Audit log
        </h1>
        <SectionLink href="/staff/audit/security" className="ml-auto">
          Suspicious activity
        </SectionLink>
      </div>

      <p className="text-sm text-semantic-text-secondary mb-6 max-w-2xl">
        Read-only query surface over <code className="font-mono text-xs">audit_log</code>.
        Use this for compliance investigations (DSAR responses, regulator inquiries),
        debugging staff actions, and reconstructing event chains. Regulatory rows are
        retained for 10 years; operational rows for 30 days.
      </p>

      <Card className="mb-6">
        <CardBody>
          {/* Native HTML GET form — submits filters as query params with no client JS. */}
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

      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm text-semantic-text-muted">
          {total === 0
            ? 'No matching events.'
            : `${total.toLocaleString('en')} event${total === 1 ? '' : 's'} · page ${page} of ${totalPages}`}
        </p>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-semantic-text-muted">View:</span>
          <Link
            href={buildUrl(page, { view: 'cards' })}
            className={view === 'cards' ? 'font-semibold text-semantic-brand' : 'text-semantic-text-muted sm:hover:text-semantic-text-secondary'}
          >
            Cards
          </Link>
          <span className="text-semantic-text-muted">·</span>
          <Link
            href={buildUrl(page, { view: 'table' })}
            className={view === 'table' ? 'font-semibold text-semantic-brand' : 'text-semantic-text-muted sm:hover:text-semantic-text-secondary'}
          >
            Table
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileMagnifyingGlass} title="No audit events" description="Adjust filters above or remove date constraints." />
      ) : view === 'table' ? (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-semantic-bg-subtle border-b border-semantic-border-subtle">
                  <tr className="text-left text-xs uppercase tracking-wider text-semantic-text-muted">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Resource</th>
                    <th className="px-3 py-2 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-semantic-border-subtle">
                  {rows.map((row) => {
                    const actor = row.actor_id ? profileMap.get(row.actor_id) : null;
                    const resourceHref = resourceDetailHref(row.resource_type, row.resource_id);
                    return (
                      <tr key={row.id} className="sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom">
                        <td className="px-3 py-2 font-mono text-xs text-semantic-text-muted whitespace-nowrap align-top">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-semantic-text-heading align-top">
                          {row.action}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <ActorCell row={row} actor={actor} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="text-semantic-text-primary">{row.resource_type}</span>
                          {row.resource_id && (
                            <>
                              {' / '}
                              {resourceHref ? (
                                <Link href={resourceHref} className="font-mono text-xs text-semantic-brand sm:hover:underline">
                                  {row.resource_id.slice(0, 8)}…
                                </Link>
                              ) : (
                                <span className="font-mono text-xs text-semantic-text-muted">{row.resource_id.slice(0, 8)}…</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant={row.retention_class === 'regulatory' ? 'trust' : 'default'}>
                            {row.retention_class}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
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
                      <ActorCell row={row} actor={actor} />
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

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        buildUrl={buildUrl}
      />
    </div>
  );
}

interface ActorCellProps {
  row: AuditLogRow;
  actor: Profile | null | undefined;
}

function ActorCell({ row, actor }: ActorCellProps) {
  if (row.actor_type !== 'user') {
    return <span className="capitalize">{row.actor_type}</span>;
  }
  if (!actor) {
    return <span className="font-mono text-xs">{row.actor_id}</span>;
  }
  return (
    <Link
      href={`/staff/users/${row.actor_id}`}
      className="text-semantic-brand sm:hover:underline"
    >
      {actor.full_name ?? actor.email ?? row.actor_id}
    </Link>
  );
}
