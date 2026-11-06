import { describe, it, expect } from 'vitest';
import { buildPageMetadata } from './page-metadata';
import { OG_IMAGES, TWITTER_IMAGES } from './og';

describe('buildPageMetadata', () => {
  it('sets title, description and a canonical for the given path', () => {
    const m = buildPageMetadata({ title: 'Help Center', description: 'Answers.', path: '/help' });
    expect(m.title).toBe('Help Center');
    expect(m.description).toBe('Answers.');
    expect(m.alternates).toEqual({ canonical: '/help' });
  });

  it('emits a full openGraph card with the page url and default image', () => {
    const m = buildPageMetadata({ title: 'Help Center', description: 'Answers.', path: '/help' });
    expect(m.openGraph).toEqual({
      type: 'website',
      siteName: 'Second Turn Games',
      title: 'Help Center | Second Turn Games',
      description: 'Answers.',
      url: '/help',
      images: OG_IMAGES,
    });
  });

  it('emits a matching twitter card with the default image', () => {
    const m = buildPageMetadata({ title: 'Help Center', description: 'Answers.', path: '/help' });
    expect(m.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Help Center | Second Turn Games',
      description: 'Answers.',
      images: TWITTER_IMAGES,
    });
  });

  it('applies social title/description overrides to both cards', () => {
    const m = buildPageMetadata({
      title: 'Catan',
      description: 'Long description.',
      path: '/listings/abc',
      socialTitle: 'Catan — 20,00 €',
      socialDescription: 'Short.',
    });
    expect(m.openGraph).toMatchObject({ title: 'Catan — 20,00 €', description: 'Short.' });
    expect(m.twitter).toMatchObject({ title: 'Catan — 20,00 €', description: 'Short.' });
    expect(m.description).toBe('Long description.');
  });

  it('uses custom images for both cards when given', () => {
    const img = { url: 'https://example.com/a.png', alt: 'A' };
    const m = buildPageMetadata({ title: 'T', description: 'D', path: '/x', images: [img] });
    expect(m.openGraph).toMatchObject({ images: [img] });
    expect(m.twitter).toMatchObject({ images: ['https://example.com/a.png'] });
  });

  it('falls back to the default image when given an empty image list', () => {
    const m = buildPageMetadata({ title: 'T', description: 'D', path: '/x', images: [] });
    expect(m.openGraph).toMatchObject({ images: OG_IMAGES });
  });

  it('passes through og:type', () => {
    const m = buildPageMetadata({ title: 'T', description: 'D', path: '/sellers/1', type: 'profile' });
    expect(m.openGraph).toMatchObject({ type: 'profile' });
  });

  it.each(['help', '/browse?q=catan', '/help#faq', 'https://secondturn.games/help'])(
    'rejects non-bare path %s',
    (path) => {
      expect(() => buildPageMetadata({ title: 'T', description: 'D', path })).toThrow(/bare absolute path/);
    }
  );
});
