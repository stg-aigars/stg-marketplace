/**
 * Batch-fetch display names from public_profiles.
 * Accepts any Supabase client (server or service role).
 */
export async function fetchProfileNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (...args: any[]) => any },
  userIds: string[]
): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, full_name')
    .in('id', userIds);

  return new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name])
  );
}
