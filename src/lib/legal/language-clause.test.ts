import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEGAL_DISCLAIMER_MESSAGES,
  LEGAL_DISCLAIMER_CLAUSE_BRIDGE,
  TRANSLATED_LANGS,
  type LegalDocId,
  type LegalDocLang,
} from './constants';

/**
 * Regression guard for the Language clause in each of the three legal documents
 * across all four languages (en/lv/lt/et = 12 doc-lang combinations).
 *
 * Rationale: the clause is the contractual basis for the translation-disclaimer
 * banner shown on translated copies (/terms/lv etc.). If a future edit deletes
 * or rewords this clause without coordinating with the translated copies + their
 * disclaimer banner, the disclaimer would assert something the contract no longer
 * establishes. This test fails fast in that case.
 *
 * Reads from per-language content modules at
 * `app/[locale]/{doc}/_content/{lang}.tsx`.
 *
 * Whitespace: prose substrings are matched against a normalized copy of the
 * source (collapsed whitespace) so the assertions survive a future Prettier
 * reformat that wraps the clause body differently. Heading substrings are
 * matched against the raw source — they're single tokens that don't wrap.
 *
 * Banner-clause substring bridge: the "binding/authoritative" framing substring
 * from LEGAL_DISCLAIMER_CLAUSE_BRIDGE must appear in both the banner message
 * (LEGAL_DISCLAIMER_MESSAGES) and the §17/§10/§14 clause body in
 * _content/{lang}.tsx. Drift between the banner and the clause is a test failure,
 * not a production bug.
 */

const SRC_ROOT = join(__dirname, '..', '..');

function readPageSource(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), 'utf-8');
}

function normalize(source: string): string {
  return source.replace(/\s+/g, ' ');
}

describe('Language clause — Terms of Service (EN)', () => {
  const source = readPageSource('app/[locale]/terms/_content/en.tsx');
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

describe('Language clause — Seller Agreement (EN)', () => {
  const source = readPageSource('app/[locale]/seller-terms/_content/en.tsx');
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

describe('Language clause — Privacy Policy (EN)', () => {
  const source = readPageSource('app/[locale]/privacy/_content/en.tsx');
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

/**
 * Cookie Policy uses "authoritative" framing matching Privacy §14 (both are
 * notices under EU privacy law, not bilateral contracts). The clause heading
 * is unnumbered to match the existing cookies-page convention.
 *
 * Reads from per-language content modules under _content/.
 * Commit 3 of this PR extends to cover all 4 doc-lang combinations
 * for cookies and adds banner-clause bridge assertions.
 */
describe('Language clause — Cookie Policy (EN)', () => {
  const source = readPageSource('app/[locale]/cookies/_content/en.tsx');
  const normalized = normalize(source);

  it('contains the Language section heading', () => {
    expect(normalized).toContain('Language </h2>');
  });

  it('declares the English version authoritative', () => {
    expect(normalized).toContain('English version is the authoritative original');
  });

  it('declares the English version shall prevail on conflict', () => {
    expect(normalized).toContain('English version shall prevail');
  });
});

/**
 * Translation assertions for the §17/§10/§14 Language clause in each of the
 * nine translation modules. Each row carries the language-specific opening
 * phrase of the clause body and the "English version" framing substring —
 * both must appear in the (normalized) source.
 */

interface TranslationAssertion {
  doc: LegalDocId;
  lang: Exclude<LegalDocLang, 'en'>;
  sectionHeading: string;
  clauseOpening: string;
  englishVersionPhrase: string;
  describeLabel: string;
}

const TRANSLATION_ASSERTIONS: TranslationAssertion[] = [
  // Terms §17
  {
    doc: 'terms',
    lang: 'lv',
    sectionHeading: '17. Valoda',
    clauseOpening: 'Šo noteikumu tulkojumi',
    englishVersionPhrase: 'Angļu valodas versija',
    describeLabel: 'Language clause — Terms of Service (LV)',
  },
  {
    doc: 'terms',
    lang: 'lt',
    sectionHeading: '17. Kalba',
    clauseOpening: 'Šių Sąlygų vertimai',
    englishVersionPhrase: 'Anglų kalbos versija',
    describeLabel: 'Language clause — Terms of Service (LT)',
  },
  {
    doc: 'terms',
    lang: 'et',
    sectionHeading: '17. Keel',
    clauseOpening: 'Käesolevate tingimuste tõlkeid',
    englishVersionPhrase: 'Ingliskeelne versioon',
    describeLabel: 'Language clause — Terms of Service (ET)',
  },
  // Seller Agreement §10
  {
    doc: 'seller-terms',
    lang: 'lv',
    sectionHeading: '10. Valoda',
    clauseOpening: 'Šī līguma tulkojumi',
    englishVersionPhrase: 'Angļu valodas versija',
    describeLabel: 'Language clause — Seller Agreement (LV)',
  },
  {
    doc: 'seller-terms',
    lang: 'lt',
    sectionHeading: '10. Kalba',
    clauseOpening: 'Šios Sutarties vertimai',
    englishVersionPhrase: 'Anglų kalbos versija',
    describeLabel: 'Language clause — Seller Agreement (LT)',
  },
  {
    doc: 'seller-terms',
    lang: 'et',
    sectionHeading: '10. Keel',
    clauseOpening: 'Käesoleva lepingu tõlkeid',
    englishVersionPhrase: 'Ingliskeelne versioon',
    describeLabel: 'Language clause — Seller Agreement (ET)',
  },
  // Privacy §14
  {
    doc: 'privacy',
    lang: 'lv',
    sectionHeading: '14. Valoda',
    clauseOpening: 'Šīs politikas tulkojumi',
    englishVersionPhrase: 'Angļu valodas versija',
    describeLabel: 'Language clause — Privacy Policy (LV)',
  },
  {
    doc: 'privacy',
    lang: 'lt',
    sectionHeading: '14. Kalba',
    clauseOpening: 'Šios politikos vertimai',
    englishVersionPhrase: 'Anglų kalbos versija',
    describeLabel: 'Language clause — Privacy Policy (LT)',
  },
  {
    doc: 'privacy',
    lang: 'et',
    sectionHeading: '14. Keel',
    clauseOpening: 'Käesoleva poliitika tõlkeid',
    englishVersionPhrase: 'Ingliskeelne versioon',
    describeLabel: 'Language clause — Privacy Policy (ET)',
  },
];

for (const t of TRANSLATION_ASSERTIONS) {
  describe(t.describeLabel, () => {
    const source = readPageSource(`app/[locale]/${t.doc}/_content/${t.lang}.tsx`);
    const normalized = normalize(source);

    it(`contains the §${t.sectionHeading.split('.')[0]} heading`, () => {
      expect(source).toContain(t.sectionHeading);
    });

    it('opens the translation-disclaimer clause with the expected phrase', () => {
      expect(normalized).toContain(t.clauseOpening);
    });

    it('mentions the English version as the authoritative / binding original', () => {
      expect(normalized).toContain(t.englishVersionPhrase);
    });
  });
}

/**
 * Banner-clause substring bridge: the framing substring defined in
 * LEGAL_DISCLAIMER_CLAUSE_BRIDGE must appear in both the disclaimer message
 * (LEGAL_DISCLAIMER_MESSAGES) and the corresponding clause body in
 * _content/{lang}.tsx. Catches drift in either direction:
 *
 *   - Editing the clause to a different framing (e.g., "authoritative" → "binding"
 *     on Privacy) without updating the banner.
 *   - Editing the banner without updating the clause.
 *
 * The constants in constants.ts are the single source of truth for both.
 */

const DOCS: LegalDocId[] = ['terms', 'seller-terms', 'privacy'];

describe('Banner-clause substring bridge', () => {
  for (const doc of DOCS) {
    for (const lang of TRANSLATED_LANGS) {
      it(`${doc}/${lang}: bridge phrase appears in both banner and clause`, () => {
        const bridge = LEGAL_DISCLAIMER_CLAUSE_BRIDGE[doc][lang];
        const banner = LEGAL_DISCLAIMER_MESSAGES[doc][lang];
        const clauseSource = readPageSource(
          `app/[locale]/${doc}/_content/${lang}.tsx`,
        );

        expect(banner).toContain(bridge);
        expect(normalize(clauseSource)).toContain(bridge);
      });
    }
  }
});
