import { describe, expect, it } from 'vitest';
import { markdownExcerpt } from './excerpt';

describe('markdownExcerpt', () => {
  it('strips bold + italic + link syntax', () => {
    expect(markdownExcerpt('**bold** and [link](https://x)')).toBe('bold and link');
  });

  it('strips heading hashes', () => {
    expect(markdownExcerpt('# Big heading\n\nbody text')).toBe('Big heading\n\nbody text');
  });

  it('strips inline code backticks', () => {
    expect(markdownExcerpt('Run `npm install` to get started')).toBe(
      'Run npm install to get started',
    );
  });

  it('truncates at maxLength with an ellipsis', () => {
    expect(markdownExcerpt('a'.repeat(200), 50)).toMatch(/^a{50}…$/);
  });

  it('returns text under maxLength unchanged', () => {
    expect(markdownExcerpt('Short body', 160)).toBe('Short body');
  });
});
