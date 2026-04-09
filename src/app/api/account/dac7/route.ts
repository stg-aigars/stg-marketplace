import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { requireBrowserOrigin } from '@/lib/api/csrf';
import { submitDac7Data } from '@/lib/dac7/service';
import { isValidBalticTIN, isValidIBAN, cleanTIN, cleanIBAN } from '@/lib/dac7/validation';

export async function POST(request: Request) {
  const csrfError = requireBrowserOrigin(request);
  if (csrfError) return csrfError;

  const { response, user } = await requireAuth();
  if (response) return response;

  let dateOfBirth: string;
  let taxId: string;
  let taxCountry: string;
  let address: string;
  let iban: string;

  try {
    const body = await request.json();
    dateOfBirth = body.dateOfBirth?.trim();
    taxId = cleanTIN(body.taxId ?? '');
    taxCountry = body.taxCountry?.trim();
    address = body.address?.trim();
    iban = cleanIBAN(body.iban ?? '');

    if (!dateOfBirth) {
      return NextResponse.json({ error: 'Date of birth is required' }, { status: 400 });
    }
    if (!taxId) {
      return NextResponse.json({ error: 'Tax identification number is required' }, { status: 400 });
    }
    if (!taxCountry) {
      return NextResponse.json({ error: 'Country of tax residence is required' }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }
    if (!iban) {
      return NextResponse.json({ error: 'IBAN is required' }, { status: 400 });
    }
    if (!isValidBalticTIN(taxId, taxCountry)) {
      return NextResponse.json({ error: 'Invalid tax identification number format' }, { status: 400 });
    }
    if (!isValidIBAN(iban)) {
      return NextResponse.json({ error: 'Invalid IBAN format' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = await submitDac7Data(user.id, {
    dateOfBirth,
    taxId,
    taxCountry,
    address,
    iban,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
