import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { markReportsSubmitted } from '@/lib/dac7/report';

export async function POST(request: Request) {
  const { response } = await requireStaffAuth();
  if (response) return response;

  let year: number;
  try {
    const body = await request.json();
    year = body.year;
    if (!year || year < 2024 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const marked = await markReportsSubmitted(year);
  return NextResponse.json({ marked });
}
