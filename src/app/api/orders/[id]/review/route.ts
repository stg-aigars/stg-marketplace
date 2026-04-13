import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { submitReview } from '@/lib/reviews/service';
import { REVIEW_MAX_COMMENT_LENGTH } from '@/lib/reviews/constants';
import { orderActionLimiter, applyRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const rateLimitError = applyRateLimit(orderActionLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response } = await requireAuth();
  if (response) return response;

  // Parse and validate body
  let isPositive: boolean;
  let comment: string | null;
  let sellerId: string;

  try {
    const body = await request.json();
    sellerId = body.sellerId;
    isPositive = body.isPositive;
    comment = body.comment ?? null;

    if (!sellerId || typeof sellerId !== 'string') {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });
    }
    if (typeof isPositive !== 'boolean') {
      return NextResponse.json({ error: 'isPositive must be a boolean' }, { status: 400 });
    }
    if (comment !== null && typeof comment !== 'string') {
      return NextResponse.json({ error: 'comment must be a string' }, { status: 400 });
    }
    if (comment && comment.trim().length > REVIEW_MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment must be ${REVIEW_MAX_COMMENT_LENGTH} characters or less` },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const review = await submitReview(params.id, sellerId, isPositive, comment);

    return NextResponse.json({ success: true, review });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit review';

    // Duplicate review
    if (message === 'You have already reviewed this order') {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    // RLS denial (not authorized to review this order)
    if (message.includes('row-level security') || message.includes('policy')) {
      return NextResponse.json(
        { error: 'You are not eligible to review this order' },
        { status: 403 }
      );
    }

    console.error('[Reviews] Submit failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
