'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function dismissOnboarding(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to dismiss onboarding:', error);
    return { error: 'Something went wrong. Please try again' };
  }

  revalidatePath('/account');
  return { success: true };
}
