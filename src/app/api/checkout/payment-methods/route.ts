import { NextRequest, NextResponse } from 'next/server';
import { getPaymentMethods } from '@/lib/services/everypay/client';
import { requireAuth } from '@/lib/auth/helpers';
import { paymentLimiter, applyRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/checkout/payment-methods?country=LV
 * Returns available payment methods filtered by buyer's country.
 * Cards (country_code === null) are always included.
 */
export async function GET(request: NextRequest) {
  const rateLimitError = applyRateLimit(paymentLimiter, request);
  if (rateLimitError) return rateLimitError;

  const { response } = await requireAuth();
  if (response) return response;

  try {
    const country = request.nextUrl.searchParams.get('country');

    const allMethods = await getPaymentMethods();

    const filtered = country
      ? allMethods.filter(
          (m) => m.country_code === null || m.country_code === country
        )
      : allMethods;

    // Sort alphabetically by display_name (cards first since they lack country_code)
    const sorted = [...filtered].sort((a, b) =>
      a.display_name.localeCompare(b.display_name)
    );

    const methods = sorted.map(({ source, display_name, logo_url }) => ({
      source,
      display_name,
      logo_url,
    }));

    return NextResponse.json(methods, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('[Payment Methods] Failed to fetch:', error);
    return NextResponse.json([], { status: 200 });
  }
}
