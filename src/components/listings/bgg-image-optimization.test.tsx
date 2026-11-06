// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ListingCard } from './ListingCard';
import { ListingCardMini } from './ListingCardMini';
import { GameThumb } from './atoms/GameThumb';
import { WantedListingCard } from '@/components/wanted/WantedListingCard';

afterEach(() => cleanup());

// BGG serves only full-resolution originals (size variants are covered by the
// URL signature), so display surfaces must resize through /_next/image rather
// than hotlink the original. A 300px card was downloading up to 2.5 MB.
const BGG_SMALL =
  'https://cf.geekdo-images.com/Eq7LLhl0fUbQep--SIWbJg__small/img/R2s6CxE-kEl7I6rVUTliEvVpWGA=/fit-in/200x150/filters:strip_icc()/pic9374335.png';

function soleImg(container: HTMLElement): HTMLImageElement {
  const imgs = container.querySelectorAll('img');
  expect(imgs).toHaveLength(1);
  return imgs[0];
}

function expectOptimized(img: HTMLImageElement) {
  const src = img.getAttribute('src') ?? '';
  expect(src.startsWith('/_next/image?url=')).toBe(true);
  // Source must be the upgraded original, so the optimizer has resolution to work with.
  expect(decodeURIComponent(src)).toContain('__original/');
  expect(img.getAttribute('srcset')).toMatch(/\/_next\/image\?url=.*\s\d+w/);
}

describe('BGG game art goes through the image optimizer', () => {
  it('ListingCard', () => {
    const { container } = render(
      <ListingCard id="l1" gameTitle="Catan" gameThumbnail={BGG_SMALL} firstPhoto={null} priceCents={2000} />
    );
    expectOptimized(soleImg(container));
  });

  it('ListingCardMini', () => {
    const { container } = render(
      <ListingCardMini
        id="l1"
        gameTitle="Catan"
        gameThumbnail={BGG_SMALL}
        firstPhoto={null}
        condition="like_new"
        priceCents={2000}
      />
    );
    expectOptimized(soleImg(container));
  });

  it('WantedListingCard', () => {
    const { container } = render(
      <WantedListingCard
        id="w1"
        gameTitle="Catan"
        gameYear={1995}
        editionYear={null}
        gameThumbnail={BGG_SMALL}
        versionThumbnail={null}
        language={null}
        publisher={null}
        notes={null}
      />
    );
    expectOptimized(soleImg(container));
  });

  it('GameThumb', () => {
    // GameThumb is fed thumbnails as-is (no full-size upgrade), so only assert routing.
    const { container } = render(<GameThumb src={BGG_SMALL} alt="Catan" size="md" />);
    const img = soleImg(container);
    expect(img.getAttribute('src')?.startsWith('/_next/image?url=')).toBe(true);
    expect(img.getAttribute('srcset')).toMatch(/\/_next\/image\?url=.*\s\d+w/);
  });
});
