import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { openDispute } from '@/lib/services/dispute';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    let reason: string;
    let photos: string[] = [];
    try {
      const body = await request.json();
      reason = body.reason;
      if (Array.isArray(body.photos)) {
        photos = body.photos.slice(0, 4);
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const { order } = await openDispute(params.id, user.id, reason.trim(), photos);

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dispute order';
    console.error('[Orders] Dispute failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
