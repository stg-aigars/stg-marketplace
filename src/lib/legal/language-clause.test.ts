import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard for the Language clause in each of the three legal documents.
 * Asserts that each page source contains the section heading and the
 * load-bearing substrings of the clause body.
 *
 * Rationale: the clause is the contractual basis for the translation-disclaimer
 * banner shown on translated copies of these documents (/terms/lv etc., shipping
 * in the follow-up translations PR). If a future edit deletes or rewords this
 * clause without coordinating with the translated copies + their disclaimer
 * banner, the disclaimer would assert something the contract no longer
 * establishes. This test fails fast in that case.
 *
 * Path coupling: this test reads English content directly from
 * `app/[locale]/{terms,seller-terms,privacy}/page.tsx`. When the translations PR
 * extracts content into `_content/en.tsx` modules, update these paths.
 *
 * Whitespace: prose substrings are matched against a normalized copy of the
 * source (collapsed whitespace) so the assertions survive a future Prettier
 * reformat that wraps the clause body differently. Heading substrings are
 * matched against the raw source — they're single tokens that don't wrap.
 */

const SRC_ROOT = join(__dirname, '..', '..');

function readPageSource(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), 'utf-8');
}

function normalize(source: string): string {
  return source.replace(/\s+/g, ' ');
}

describe('Language clause — Terms of Service', () => {
  const source = readPageSource('app/[locale]/terms/page.tsx');
  const normalized = normalize(source);

  it('contains the §17 Language heading', () => {
    expect(source).toContain('17. Language');
  });

  it('declares the English version legally binding', () => {
    expect(normalized).toContain('English version is the legally binding original');
  });

  it('declares the English version prevails on conflict', () => {
    expect(normalized).toContain('English version prevails');
  });
});

describe('Language clause — Seller Agreement', () => {
  const source = readPageSource('app/[locale]/seller-terms/page.tsx');
  const normalized = normalize(source);

  it('contains the §10 Language heading', () => {
    expect(source).toContain('10. Language');
  });

  it('declares the English version legally binding', () => {
    expect(normalized).toContain('English version is the legally binding original');
  });

  it('declares the English version prevails on conflict', () => {
    expect(normalized).toContain('English version prevails');
  });
});

describe('Language clause — Privacy Policy', () => {
  const source = readPageSource('app/[locale]/privacy/page.tsx');
  const normalized = normalize(source);

  it('contains the §14 Language heading', () => {
    expect(source).toContain('14. Language');
  });

  it('declares the English version authoritative', () => {
    expect(normalized).toContain('English version is the authoritative original');
  });

  it('declares the English version prevails on discrepancy', () => {
    expect(normalized).toContain('English version prevails');
  });
});
