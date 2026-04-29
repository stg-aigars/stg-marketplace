import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, CardBody, Badge, SectionLink } from '@/components/ui';
import { fetchProfiles, type Profile } from '@/lib/supabase/helpers';
import { formatDateTime } from '@/lib/date-utils';

interface AuditRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_type: 'user' | 'system' | 'cron';
  action: string;
  retention_class: 'operational' | 'regulatory';
}

interface ResourceAuditTimelineProps {
  /** Server-side service-role Supabase client. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: SupabaseClient<any, any, any>;
  resourceType: string;
  resourceId: string;
  /** Optional secondary filter: include events where actor_id matches the
   *  given UUID. Used on user detail pages where the user's own actions
   *  (e.g. terms.accepted, seller_terms.accepted) are recorded with the
   *  user as actor rather than as resource. */
  alsoIncludeAsActor?: string;
  /** Maximum number of events to fetch + render. Defaults to 10. */
  limit?: number;
  /** Card heading. Defaults to "Recent activity". */
  title?: string;
}

/**
 * Compact inline audit-log timeline for a single resource. Server Component —
 * renders ~10 most recent events keyed off (resource_type, resource_id) in
 * descending order, plus a "View all" link to /staff/audit with the same
 * filter applied. Resolves user actor names via fetchProfiles in batch.
 *
 * Use on detail pages (dispute, user, etc.) so staff doesn't have to leave
 * the page to reconstruct what happened. The full audit log query surface
 * at /staff/audit remains the long-form view with filters and pagination.
 */
export async function ResourceAuditTimeline({
  serviceClient,
  resourceType,
  resourceId,
  alsoIncludeAsActor,
  limit = 10,
  title = 'Recent activity',
}: ResourceAuditTimelineProps) {
  // Two queries when alsoIncludeAsActor is set, one query otherwise. The
  // union is a small set so app-side merge + sort is fine.
  const queries = [
    serviceClient
      .from('audit_log')
      .select('id, created_at, actor_id, actor_type, action, retention_class')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ];
  if (alsoIncludeAsActor) {
    queries.push(
      serviceClient
        .from('audit_log')
        .select('id, created_at, actor_id, actor_type, action, retention_class')
        .eq('actor_id', alsoIncludeAsActor)
        .order('created_at', { ascending: false })
        .limit(limit),
    );
  }

  const results = await Promise.all(queries);
  // Each branch caps at `limit`; merging + sorting + slicing again can drop a
  // globally-recent event when one branch is much busier than the other.
  // Acceptable for the inline-summary use case — the "View all" link is the
  // long-form view if staff needs the global ordering.
  const merged: AuditRow[] = [];
  const seenIds = new Set<string>();
  for (const result of results) {
    for (const row of (result.data ?? []) as AuditRow[]) {
      if (!seenIds.has(row.id)) {
        merged.push(row);
        seenIds.add(row.id);
      }
    }
  }
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const rows = merged.slice(0, limit);

  const userActorIds = Array.from(
    new Set(
      rows
        .filter((r) => r.actor_type === 'user' && r.actor_id)
        .map((r) => r.actor_id as string),
    ),
  );
  const profileMap: Map<string, Profile> = userActorIds.length > 0
    ? await fetchProfiles(serviceClient, userActorIds)
    : new Map();

  const fullLogHref = `/staff/audit?resource_type=${resourceType}&resource_id=${resourceId}`;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-semantic-text-heading">{title}</h2>
          <SectionLink href={fullLogHref}>View all</SectionLink>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-semantic-text-muted">No recorded events for this resource.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {rows.map((row) => {
              const actor = row.actor_id ? profileMap.get(row.actor_id) : null;
              const actorLabel = row.actor_type === 'user'
                ? (actor?.full_name ?? actor?.email ?? row.actor_id ?? 'user')
                : row.actor_type;
              return (
                <li key={row.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-mono text-semantic-text-muted shrink-0">
                    {formatDateTime(row.created_at)}
                  </span>
                  <span className="font-mono text-xs text-semantic-text-heading">
                    {row.action}
                  </span>
                  <span className="text-xs text-semantic-text-muted">
                    by{' '}
                    {row.actor_type === 'user' && row.actor_id ? (
                      <Link
                        href={`/staff/users/${row.actor_id}`}
                        className="link-brand"
                      >
                        {actorLabel}
                      </Link>
                    ) : (
                      <span className="capitalize">{actorLabel}</span>
                    )}
                  </span>
                  {row.retention_class === 'regulatory' && (
                    <Badge variant="trust">regulatory</Badge>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
