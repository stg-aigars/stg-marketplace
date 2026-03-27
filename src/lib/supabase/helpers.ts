export interface Profile {
  id: string;
  full_name: string;
  email: string;
}

/** Fetch user profiles by IDs in a single query. */
export async function fetchProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  ids: string[]
): Promise<Map<string, Profile>> {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', ids);
  return new Map((data as Profile[] ?? []).map((p: Profile) => [p.id, p]));
}
