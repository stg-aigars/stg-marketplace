'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/helpers';

export async function findExistingThread(otherUserId: string): Promise<{ threadId: string | null }> {
  const { user } = await requireServerAuth();
  const supabase = await createClient();
  const [a, b] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

  const { data } = await supabase
    .from('message_threads')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle();

  return { threadId: data?.id ?? null };
}
