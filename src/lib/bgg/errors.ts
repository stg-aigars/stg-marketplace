/**
 * Structured BGG error types with user-friendly messages
 */

export type BGGErrorCode =
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'API_UNAVAILABLE'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class BGGError extends Error {
  constructor(
    public code: BGGErrorCode,
    public userMessage: string,
    public retryAfter?: number
  ) {
    super(userMessage);
    this.name = 'BGGError';
  }
}

export function createRateLimitError(retryAfter: number = 5): BGGError {
  return new BGGError(
    'RATE_LIMIT',
    'BoardGameGeek is receiving too many requests. Please try again shortly.',
    retryAfter
  );
}

export function createAPIUnavailableError(): BGGError {
  return new BGGError(
    'API_UNAVAILABLE',
    'BoardGameGeek is temporarily unavailable. Please try again later.'
  );
}

export function createTimeoutError(): BGGError {
  return new BGGError(
    'TIMEOUT',
    'BoardGameGeek is responding slowly. Please try again.'
  );
}

export function parseFetchError(error: unknown): BGGError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new BGGError('NETWORK_ERROR', 'Unable to reach BoardGameGeek. Check your internet connection.');
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
    return createTimeoutError();
  }
  return new BGGError('UNKNOWN', 'An unexpected error occurred while contacting BoardGameGeek.');
}
