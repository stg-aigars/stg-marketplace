import { NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
import { generateAnnualReports } from '@/lib/dac7/report';
import { generateDpiXml } from '@/lib/dac7/xml-generator';
import { createServiceClient } from '@/lib/supabase';

/** POST — Generate reports for a year */
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

  const result = await generateAnnualReports(year);
  return NextResponse.json({
    complete: result.complete.length,
    incomplete: result.incomplete.length,
    incompleteDetails: result.incomplete,
  });
}

/** GET — Download XML for a year */
export async function GET(request: Request) {
  const { response } = await requireStaffAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '', 10);

  if (!year || year < 2024) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: reports } = await supabase
    .from('dac7_annual_reports')
    .select('report_data')
    .eq('calendar_year', year);

  if (!reports || reports.length === 0) {
    return NextResponse.json({ error: 'No reports found for this year' }, { status: 404 });
  }

  const reportData = reports.map((r) => r.report_data);
  const xml = generateDpiXml(reportData, year);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="dac7-${year}.xml"`,
    },
  });
}
