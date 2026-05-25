import { describe, expect, it } from 'vitest';
import { slugifyTitle, validateSlug } from './slug';

describe('slugifyTitle', () => {
  it('kebab-cases plain ASCII', () => {
    expect(slugifyTitle('Hello World')).toBe('hello-world');
  });

  it('strips diacritics (Latvian, German)', () => {
    expect(slugifyTitle('Café Münchën')).toBe('cafe-munchen');
  });

  it('collapses whitespace + punctuation into single dashes', () => {
    expect(slugifyTitle("What's new?!")).toBe('what-s-new');
  });

  it('trims leading + trailing dashes', () => {
    expect(slugifyTitle('-- weird -- ')).toBe('weird');
  });

  it('caps at 80 chars', () => {
    const long = 'x'.repeat(120);
    expect(slugifyTitle(long).length).toBeLessThanOrEqual(80);
  });
});

describe('validateSlug', () => {
  it.each(['hello-world', 'v1', 'abc-123', 'wishlists-launch'])('accepts %s', (s) => {
    expect(validateSlug(s)).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    expect(validateSlug('')).toEqual({ ok: false, reason: 'slug_empty' });
  });

  it('rejects uppercase + whitespace + non-kebab characters', () => {
    expect(validateSlug('HELLO').ok).toBe(false);
    expect(validateSlug('with space').ok).toBe(false);
    expect(validateSlug('under_score').ok).toBe(false);
  });

  it('rejects leading + trailing dashes', () => {
    expect(validateSlug('-leading').ok).toBe(false);
    expect(validateSlug('trailing-').ok).toBe(false);
  });

  it('rejects reserved slugs that would collide with route segments', () => {
    expect(validateSlug('new').ok).toBe(false);
    expect(validateSlug('edit').ok).toBe(false);
  });

  it('rejects > 80 chars', () => {
    expect(validateSlug('x'.repeat(81)).ok).toBe(false);
  });
});
