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
  completedCount: number;
  totalCount: number;
}

const DISMISSED_STATE: OnboardingState = {
  dismissed: true,
  items: [],
  completedCount: 0,
  totalCount: 0,
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
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', user.id),
    supabase
      .from('shelf_items')
      .select('*', { count: 'exact', head: true })
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
      description: 'Give a pre-loved game a new home',
      complete: (listingsResult.count ?? 0) > 0,
      href: '/sell',
    },
    {
      id: 'shelf',
      label: 'Add a game to your shelf',
      description: 'Showcase your collection',
      complete: (shelfResult.count ?? 0) > 0,
      href: '/account/shelf',
    },
  ];

  const completedCount = items.filter((item) => item.complete).length;

  return {
    dismissed: false,
    items,
    completedCount,
    totalCount: items.length,
  };
}
