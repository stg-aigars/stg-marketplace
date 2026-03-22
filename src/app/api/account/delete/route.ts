import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { accountDeleteLimiter, applyRateLimit } from '@/lib/rate-limit';
import { checkDeletionEligibility, deleteUserAccount } from '@/lib/services/account';

export async function DELETE(request: Request) {
  const rateLimitError = applyRateLimit(accountDeleteLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user, supabase } = await requireAuth();
  if (response) return response;

  try {
    const body = await request.json();

    const providers = user.app_metadata?.providers as string[] | undefined;
    const isEmailUser = providers?.includes('email');

    if (isEmailUser) {
      const password = body.password as string | undefined;
      if (!password) {
        return NextResponse.json(
          { error: 'Password is required to delete your account' },
          { status: 400 }
        );
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (signInError) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    }

    // Check eligibility
    const eligibility = await checkDeletionEligibility(user.id);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: 'Cannot delete account', reasons: eligibility.reasons },
        { status: 409 }
      );
    }

    // Delete account
    const result = await deleteUserAccount(user.id, user.email!);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
