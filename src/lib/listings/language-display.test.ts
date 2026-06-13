import { describe, it, expect } from 'vitest';
import {
  parseLanguages,
  sortLanguagesByPriority,
  buildLanguageDisplay,
  LANGUAGE_PREVIEW_COUNT,
} from './language-display';

describe('parseLanguages', () => {
  it('splits a comma-joined string into trimmed names', () => {
    expect(parseLanguages('English, French, German')).toEqual(['English', 'French', 'German']);
  });

  it('returns a single-element array for one language', () => {
    expect(parseLanguages('English')).toEqual(['English']);
  });

  it('drops empty segments from trailing or doubled commas', () => {
    expect(parseLanguages('English, , German,')).toEqual(['English', 'German']);
  });
});

describe('sortLanguagesByPriority', () => {
  it('surfaces Baltic-priority languages first in defined order', () => {
    const sorted = sortLanguagesByPriority(['French', 'Latvian', 'English', 'Estonian']);
    expect(sorted).toEqual(['English', 'Latvian', 'Estonian', 'French']);
  });

  it('sorts non-priority languages alphabetically after the priority ones', () => {
    const sorted = sortLanguagesByPriority(['Spanish', 'German', 'Czech', 'Dutch']);
    expect(sorted).toEqual(['German', 'Czech', 'Dutch', 'Spanish']);
  });

  it('does not mutate the input array', () => {
    const input = ['French', 'English'];
    sortLanguagesByPriority(input);
    expect(input).toEqual(['French', 'English']);
  });
});

describe('buildLanguageDisplay', () => {
  it('is not collapsible for a short list', () => {
    const result = buildLanguageDisplay('English, German, French');
    expect(result.collapsible).toBe(false);
    expect(result.hiddenCount).toBe(0);
    expect(result.languages).toEqual(['English', 'German', 'French']);
  });

  it('does not collapse when it would hide only one language', () => {
    // PREVIEW_COUNT + 1 languages — collapsing saves nothing meaningful.
    const value = Array.from({ length: LANGUAGE_PREVIEW_COUNT + 1 }, (_, i) => `Lang${i}`).join(', ');
    expect(buildLanguageDisplay(value).collapsible).toBe(false);
  });

  it('collapses a genuinely long multilingual list and reports the hidden count', () => {
    const value = Array.from({ length: 18 }, (_, i) => `Lang${i}`).join(', ');
    const result = buildLanguageDisplay(value);
    expect(result.collapsible).toBe(true);
    expect(result.hiddenCount).toBe(18 - LANGUAGE_PREVIEW_COUNT);
    expect(result.languages).toHaveLength(18);
  });
});
