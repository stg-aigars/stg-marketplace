import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase';
import type { UserProfile } from './types';

/**
 * For API route handlers — returns 401 if not authenticated.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as never,
      supabase: null as never,
    };
  }

  return { response: null, user, supabase };
}

/**
 * For server components — redirects to signin if not authenticated.
 */
export async function requireServerAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/auth/signin');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single<UserProfile>();

  const serviceClient = createServiceClient();

  return {
    user,
    profile,
    isStaff: profile?.is_staff ?? false,
    serviceClient,
  };
}
