import { describe, it, expect } from 'vitest';
import { isStaleActionError } from './stale-action-guard';

describe('isStaleActionError', () => {
  it('matches errors whose name is UnrecognizedActionError', () => {
    const err = Object.assign(new Error('boom'), { name: 'UnrecognizedActionError' });
    expect(isStaleActionError(err)).toBe(true);
  });

  it('matches errors whose message contains the Server Action not-found phrase', () => {
    const err = new Error('Server Action "00f4075c" was not found on the server');
    expect(isStaleActionError(err)).toBe(true);
  });

  it('does NOT match messages that mention only one half of the phrase', () => {
    expect(isStaleActionError(new Error('Server Action failed'))).toBe(false);
    expect(isStaleActionError(new Error('resource was not found on the server'))).toBe(false);
  });

  it('does NOT match Next.js framework control-flow digests', () => {
    // Critical: NEXT_REDIRECT / NEXT_NOT_FOUND are thrown by redirect() and
    // notFound() during normal navigation. A broad prefix match here would
    // turn every aborted navigation into a full-page reload.
    expect(isStaleActionError(Object.assign(new Error(), { digest: 'NEXT_REDIRECT;replace;/foo;307' }))).toBe(false);
    expect(isStaleActionError(Object.assign(new Error(), { digest: 'NEXT_NOT_FOUND' }))).toBe(false);
    expect(isStaleActionError(Object.assign(new Error(), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }))).toBe(false);
  });

  it('does not match unrelated errors', () => {
    expect(isStaleActionError(new Error('network down'))).toBe(false);
    expect(isStaleActionError({ digest: 'OTHER' })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(isStaleActionError(null)).toBe(false);
    expect(isStaleActionError(undefined)).toBe(false);
    expect(isStaleActionError('string')).toBe(false);
    expect(isStaleActionError(42)).toBe(false);
  });
});
