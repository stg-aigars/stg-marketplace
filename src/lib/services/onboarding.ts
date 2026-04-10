import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/auth/types';
import { createClient } from '@/lib/supabase/server';

export interface OnboardingItem {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  href: string;
}

export interface OnboardingState {
  dismissed: boolean;
  items: OnboardingItem[];
}

const DISMISSED_STATE: OnboardingState = {
  dismissed: true,
  items: [],
};

export async function getOnboardingState(
  user: User,
  profile: UserProfile | null
): Promise<OnboardingState> {
  if (!profile || profile.onboarding_dismissed_at) {
    return DISMISSED_STATE;
  }

  const supabase = await createClient();

  const [listingsResult, shelfResult] = await Promise.all([
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id),
    supabase
      .from('shelf_items')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id),
  ]);

  const items: OnboardingItem[] = [
    {
      id: 'email',
      label: 'Confirm your email',
      description: 'Check your inbox for a confirmation link',
      complete: user.email_confirmed_at != null,
      href: '/account/settings',
    },
    {
      id: 'name',
      label: 'Set your display name',
      description: 'Let other players know who you are',
      complete: profile.full_name != null && profile.full_name.trim() !== '',
      href: '/account/settings',
    },
    {
      id: 'listing',
      label: 'List your first game',
      description: 'Sell a game you are ready to pass on',
      complete: (listingsResult.count ?? 0) > 0,
      href: '/sell',
    },
    {
      id: 'shelf',
      label: 'Add a game to your shelf',
      description: 'Track your games and get offers from buyers',
      complete: (shelfResult.count ?? 0) > 0,
      href: '/account/shelf',
    },
  ];

  return {
    dismissed: false,
    items,
  };
}
