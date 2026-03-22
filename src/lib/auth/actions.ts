'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { AuthActionResult, SignInFormData, SignUpFormData } from './types';
import type { CountryCode } from '@/lib/country-utils';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';

/** Prevent open redirects — only allow relative paths. */
function safeReturnUrl(url?: string): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return '/';
  }
  return url;
}

export async function signInWithEmail(
  formData: SignInFormData,
  returnUrl?: string,
  turnstileToken?: string
): Promise<AuthActionResult> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: 'Invalid email or password' };
  }

  redirect(safeReturnUrl(returnUrl));
}

export async function signUpWithEmail(
  formData: SignUpFormData,
  turnstileToken?: string
): Promise<AuthActionResult> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.displayName,
        country: formData.country,
      },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'An account with this email already exists' };
    }
    if (error.message.includes('password')) {
      return { error: 'Password must be at least 8 characters' };
    }
    return { error: 'Something went wrong. Please try again' };
  }

  redirect('/browse?welcome=true');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function resetPassword(
  email: string,
  turnstileToken?: string
): Promise<AuthActionResult> {
  const turnstile = await verifyTurnstileToken(turnstileToken, getServerActionIp());
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?type=recovery`,
  });

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  return {};
}

export async function updatePassword(
  password: string
): Promise<AuthActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  redirect('/auth/signin');
}

export async function updateProfile(data: {
  country: CountryCode;
  displayName?: string;
  returnUrl?: string;
}): Promise<AuthActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const updates: Record<string, unknown> = {
    country: data.country,
    country_confirmed: true,
  };
  if (data.displayName) {
    updates.full_name = data.displayName;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  redirect(safeReturnUrl(data.returnUrl));
}

// ---------------------------------------------------------------------------
// Account settings actions
// ---------------------------------------------------------------------------

export async function updateDisplayName(
  name: string
): Promise<AuthActionResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'Display name cannot be empty' };
  }
  if (trimmed.length > 100) {
    return { error: 'Display name must be 100 characters or fewer' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ full_name: trimmed })
    .eq('id', user.id);

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  return { success: 'Display name updated' };
}

export async function updateEmail(
  newEmail: string
): Promise<AuthActionResult> {
  const trimmed = newEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { error: 'Please enter a valid email address' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ email: trimmed });

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return { error: 'An account with this email already exists' };
    }
    return { error: 'Something went wrong. Please try again' };
  }

  return {
    success:
      'Confirmation links sent to both your current and new email addresses. You must confirm on both to complete the change.',
  };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: 'Not authenticated' };
  }

  // Verify current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: 'Current password is incorrect' };
  }

  // Validate new password
  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  return { success: 'Password updated' };
}

export async function setPassword(
  newPassword: string
): Promise<AuthActionResult> {
  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  return { success: 'Password set. You can now sign in with email.' };
}
