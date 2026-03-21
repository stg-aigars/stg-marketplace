import { NextResponse } from 'next/server';
import { isTerminalCountry } from '@/lib/services/unisend/types';

interface TerminalInput {
  terminalId: string;
  terminalName: string;
  terminalCountry: string;
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
