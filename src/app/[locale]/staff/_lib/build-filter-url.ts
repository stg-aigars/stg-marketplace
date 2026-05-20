/**
 * Build a staff page URL from a current filter state, an override set, and a
 * defaults map. Keys whose value matches `defaults` are dropped from the
 * query string so the canonical view (e.g. `/staff/notices` with filter='open'
 * + binding='any') stays bare. Keys with undefined/empty values are also
 * dropped. If nothing remains, returns the bare basePath.
 *
 * Replaces the inline closures previously duplicated in
 * `/staff/notices`, `/staff/feedback`, and `/staff/audit`.
 */
function buildStaffFilterUrl<T extends Record<string, string | undefined>>(
  basePath: string,
  current: T,
  next: Partial<T>,
  defaults: Partial<T> = {},
): string {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    if (defaults[key as keyof T] === value) continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export { buildStaffFilterUrl };
