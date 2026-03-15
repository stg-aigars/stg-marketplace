'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { signOut as signOutAction } from '@/lib/auth/actions';
import type { UserProfile } from '@/lib/auth/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  needsCountrySelection: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfileWithRetry(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  attempts = 3
): Promise<UserProfile | null> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single<UserProfile>();

    if (data) return data;

    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (currentUser: User) => {
      const fetchedProfile = await fetchProfileWithRetry(
        supabase,
        currentUser.id
      );
      setProfile(fetchedProfile);
    },
    [supabase]
  );

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadProfile(currentUser).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        loadProfile(currentUser);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const needsCountrySelection = useMemo(() => {
    if (!user || !profile) return false;
    const providers = user.app_metadata?.providers as string[] | undefined;
    const isGoogleUser =
      user.app_metadata?.provider === 'google' ||
      (Array.isArray(providers) && providers.includes('google'));
    return isGoogleUser && profile.country === 'LV';
  }, [user, profile]);

  const handleSignOut = useCallback(async () => {
    await signOutAction();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      needsCountrySelection,
      signOut: handleSignOut,
    }),
    [user, profile, loading, needsCountrySelection, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
