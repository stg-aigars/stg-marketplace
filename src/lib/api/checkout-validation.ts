import { NextResponse } from 'next/server';
import { isTerminalCountry, type TerminalCountry } from '@/lib/services/unisend/types';
import { validatePhone } from '@/lib/phone-utils';
import { MAX_CART_ITEMS } from '@/lib/checkout/cart-types';

interface TerminalInput {
  terminalId: string;
  terminalName: string;
  terminalCountry: string;
}

export interface CartCheckoutBody {
  listingIds: string[];
  terminalId: string;
  terminalName: string;
  terminalAddress?: string;
  terminalCity?: string;
  terminalPostalCode?: string;
  terminalCountry: string;
  buyerPhone: string;
  useWallet?: boolean;
  turnstileToken?: string;
}

/** Sanitize a user-provided string: strip control characters, truncate to 200 chars */
export function sanitizeInput(s?: string): string | undefined {
  return s ? s.slice(0, 200).replace(/[\x00-\x1f\x7f]/g, '') : undefined;
}

/**
 * Validate and sanitize terminal input from checkout requests.
 * Returns a NextResponse error if invalid, or the sanitized terminal name.
 */
export function validateTerminalInput(
  input: TerminalInput
): NextResponse | { sanitizedName: string } {
  if (!isTerminalCountry(input.terminalCountry)) {
    return NextResponse.json({ error: 'Invalid terminal country' }, { status: 400 });
  }
  if (input.terminalId.length > 50) {
    return NextResponse.json({ error: 'Invalid terminal ID' }, { status: 400 });
  }
  return {
    sanitizedName: input.terminalName.slice(0, 200).replace(/[\x00-\x1f\x7f]/g, ''),
  };
}

/**
 * Parse and validate the request body for cart checkout (cart-create and cart-wallet-pay).
 * Returns a NextResponse error if invalid, or the parsed body.
 */
export async function parseCartCheckoutBody(
  request: Request
): Promise<NextResponse | CartCheckoutBody> {
  try {
    const body = await request.json();
    const { listingIds, terminalId, terminalName, terminalAddress, terminalCity, terminalPostalCode, terminalCountry, buyerPhone, useWallet, turnstileToken } = body;

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'No items in cart' }, { status: 400 });
    }
    if (listingIds.length > MAX_CART_ITEMS) {
      return NextResponse.json({ error: `Maximum ${MAX_CART_ITEMS} items per cart` }, { status: 400 });
    }
    if (new Set(listingIds).size !== listingIds.length) {
      return NextResponse.json({ error: 'Duplicate items in cart' }, { status: 400 });
    }
    if (!terminalId || !terminalName || !terminalCountry) {
      return NextResponse.json({ error: 'Please select a pickup terminal' }, { status: 400 });
    }
    const terminalCheck = validateTerminalInput({ terminalId, terminalName, terminalCountry });
    if (terminalCheck instanceof NextResponse) return terminalCheck;
    if (!buyerPhone || !validatePhone(buyerPhone, terminalCountry as TerminalCountry)) {
      return NextResponse.json({ error: `Please enter a valid ${terminalCountry} mobile number for parcel pickup` }, { status: 400 });
    }

    return {
      listingIds,
      terminalId,
      terminalName: terminalCheck.sanitizedName,
      terminalAddress: sanitizeInput(terminalAddress),
      terminalCity: sanitizeInput(terminalCity),
      terminalPostalCode: sanitizeInput(terminalPostalCode),
      terminalCountry,
      buyerPhone,
      useWallet: useWallet === true,
      turnstileToken,
    };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
