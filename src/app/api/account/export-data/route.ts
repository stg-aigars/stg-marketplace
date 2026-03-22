import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { dataExportLimiter, applyRateLimit } from '@/lib/rate-limit';
import { gatherUserData } from '@/lib/services/account';

export async function GET(request: Request) {
  const rateLimitError = applyRateLimit(dataExportLimiter, request);
  if (rateLimitError) return rateLimitError;

  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const data = await gatherUserData(user.id);
    const today = new Date().toISOString().split('T')[0];

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="stg-data-export-${today}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
