import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export { createClient as createBrowserClient } from './browser';
export { createClient as createServerClient } from './server';

export function createServiceClient() {
  return createSupabaseClient(env.supabase.url, env.supabase.serviceRoleKey);
}
