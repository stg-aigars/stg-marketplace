import { NextResponse } from 'next/server';
import { isTerminalCountry } from '@/lib/services/unisend/types';
import { isValidPhoneNumber } from '@/lib/phone-utils';
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
  terminalCountry: string;
  buyerPhone: string;
  useWallet?: boolean;
  turnstileToken?: string;
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
    const { listingIds, terminalId, terminalName, terminalCountry, buyerPhone, useWallet, turnstileToken } = body;

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
    if (!buyerPhone || !isValidPhoneNumber(buyerPhone)) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    }

    return {
      listingIds,
      terminalId,
      terminalName: terminalCheck.sanitizedName,
      terminalCountry,
      buyerPhone,
      useWallet: useWallet === true,
      turnstileToken,
    };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
