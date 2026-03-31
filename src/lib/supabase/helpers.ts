export interface PublicProfile {
  id: string;
  full_name: string | null;
  country: string | null;
}

/** Fetch public profile data by IDs (anonymous-safe, uses public_profiles view). */
export async function fetchPublicProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  ids: string[]
): Promise<Map<string, PublicProfile>> {
  const { data } = await supabase
    .from('public_profiles')
    .select('id, full_name, country')
    .in('id', ids);
  return new Map((data as PublicProfile[] ?? []).map((p: PublicProfile) => [p.id, p]));
}

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
