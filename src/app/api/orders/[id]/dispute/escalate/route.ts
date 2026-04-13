import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { escalateDispute } from '@/lib/services/dispute';
import { orderActionLimiter, applyRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const rateLimitError = applyRateLimit(orderActionLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const dispute = await escalateDispute(params.id, user.id);

    return NextResponse.json({
      success: true,
      dispute: { id: dispute.id, escalated_at: dispute.escalated_at },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to escalate dispute';
    console.error('[Orders] Escalate dispute failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
