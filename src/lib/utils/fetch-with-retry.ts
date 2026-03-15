/**
 * Fetch with automatic retry for transient failures
 * Exponential backoff for network errors and 5xx server errors.
 */

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  shouldRetry?: (error: Error, response?: Response, attempt?: number) => boolean;
}

function defaultShouldRetry(error: Error, response?: Response): boolean {
  if (!response) return true;
  return response.status >= 500;
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    shouldRetry = defaultShouldRetry,
  } = retryOptions;

  let lastError: Error | null = null;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok && shouldRetry(new Error(`HTTP ${response.status}`), response, attempt)) {
        lastResponse = response;
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries && shouldRetry(lastError)) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Max retries exceeded');
}

export function getFriendlyErrorMessage(error: unknown, response?: Response): string {
  if (response) {
    switch (response.status) {
      case 400: return 'Invalid request. Please check your input.';
      case 401: return 'Please sign in to continue.';
      case 403: return 'You do not have permission to perform this action.';
      case 404: return 'The requested resource was not found.';
      case 429: return 'Too many requests. Please wait a moment.';
      case 500: case 502: case 503: return 'Server error. Please try again later.';
      default: return `Request failed (${response.status}). Please try again.`;
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('timeout')) return 'Request timed out. Please try again.';
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection.';
    }
  }

  return 'An unexpected error occurred. Please try again.';
}
