'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { AuthActionResult, SignUpFormData } from './types';
import type { CountryCode } from '@/lib/country-utils';
import { verifyTurnstileToken, getServerActionIp } from '@/lib/turnstile';
import { loginLimiter, signupLimiter, passwordResetLimiter } from '@/lib/rate-limit';
import { TERMS_VERSION } from '@/lib/legal/constants';
import { safeReturnUrl } from '@/lib/auth/safe-return-url';
import { validatePasswordStrength } from '@/lib/auth/password-validation';
import { logAuditEvent } from '@/lib/services/audit';

type TermsAcceptanceSource = 'signup' | 'oauth_onboarding';

function logTermsAccepted(actorId: string, source: TermsAcceptanceSource): void {
  void logAuditEvent({
    actorId,
    actorType: 'user',
    action: 'terms.accepted',
    resourceType: 'terms',
    resourceId: TERMS_VERSION,
    metadata: { source },
  });
}

/**
 * Validate rate-limit and Turnstile before the client signs in.
 * The actual `signInWithPassword` must happen on the browser client
 * so that `onAuthStateChange` fires and the UI updates immediately.
 */
export async function validateSignIn(
  turnstileToken?: string
): Promise<AuthActionResult> {
  const ip = await getServerActionIp();
  const limitResult = loginLimiter.check(ip ?? 'unknown');
  if (!limitResult.success) return { error: 'Too many login attempts. Please try again later.' };

  const turnstile = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstile.success) return { error: turnstile.error };

  return {};
}

export async function signUpWithEmail(
  formData: SignUpFormData,
  turnstileToken?: string,
  returnUrl?: string
): Promise<AuthActionResult> {
  const ip = await getServerActionIp();
  const limitResult = signupLimiter.check(ip ?? 'unknown');
  if (!limitResult.success) return { error: 'Too many signup attempts. Please try again later.' };

  const turnstile = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();

  // ?signup=true survives the email confirmation round-trip and is read by the
  // auth callback to fire analytics.signup_completed. OAuth paths use a
  // created_at freshness check instead and do not need this param.
  const appUrl = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const emailRedirectTo = `${appUrl}/auth/callback?signup=true`;

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: formData.displayName,
        country: formData.country,
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
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

  if (data.user) {
    logTermsAccepted(data.user.id, 'signup');
  }

  redirect(returnUrl ? safeReturnUrl(returnUrl) : '/browse?welcome=true');
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
  const ip = await getServerActionIp();
  const limitResult = passwordResetLimiter.check(ip ?? 'unknown');
  if (!limitResult.success) return { error: 'Too many reset attempts. Please try again later.' };

  const turnstile = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstile.success) return { error: turnstile.error };

  const supabase = await createClient();
  const appUrl = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
  const strengthError = validatePasswordStrength(password);
  if (strengthError) return { error: strengthError };

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('[Auth] updateUser failed:', {
      code: error.code,
      message: error.message,
      status: error.status,
    });

    if (error.code === 'same_password') {
      return { error: 'Your new password must be different from your current password' };
    }
    if (error.code === 'weak_password') {
      return { error: 'Password does not meet security requirements' };
    }
    // Recovery session expired between clicking the email link and submitting.
    // Supabase returns session_not_found or a 401 status depending on version.
    if (error.code === 'session_not_found' || error.status === 401) {
      return { error: 'Your reset link has expired. Please request a new one.' };
    }
    if (error.status === 429) {
      return { error: 'Too many attempts. Please wait a moment and try again.' };
    }
    return { error: 'Something went wrong. Please try again' };
  }

  redirect('/auth/signin');
}

export async function updateProfile(data: {
  country: CountryCode;
  displayName?: string;
  returnUrl?: string;
  termsAccepted?: boolean;
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

  // Write terms acceptance atomically — only if not already set (first-time only).
  // The .is('terms_accepted_at', null) clause prevents overwriting an existing timestamp;
  // .select('id') then gates the audit emission so repeat calls don't duplicate events.
  if (data.termsAccepted) {
    const { data: updated, error: termsError } = await supabase
      .from('user_profiles')
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      .eq('id', user.id)
      .is('terms_accepted_at', null)
      .select('id');

    if (termsError) {
      console.error('[updateProfile] Terms write failed:', termsError);
      return { error: 'Something went wrong. Please try again' };
    }

    if (updated && updated.length > 0) {
      logTermsAccepted(user.id, 'oauth_onboarding');
    }
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

  revalidatePath('/account');
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
      'We sent confirmation links to both your current and new email. Confirm on both to complete the change.',
  };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthActionResult> {
  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: 'Not authenticated' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: 'Current password is incorrect' };
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

  // Guard: only users without a password (OAuth-only) can use this action
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }
  const providers = user.app_metadata?.providers as string[] | undefined;
  if (providers?.includes('email')) {
    return { error: 'Use Change Password instead' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: 'Something went wrong. Please try again' };
  }

  return { success: 'Password set. You can now sign in with email.' };
}
