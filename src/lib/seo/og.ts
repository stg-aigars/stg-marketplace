// Shared OG/Twitter image. Centralized because Next.js replaces the openGraph
// object per route segment (no deep field merge), so every route that sets its
// own openGraph must spread these images — otherwise the card falls back to
// scraping page content.
export const OG_IMAGE_PATH = '/og-image.png';

export const OG_IMAGES = [
  {
    url: OG_IMAGE_PATH,
    width: 1200,
    height: 630,
    alt: 'Second Turn Games — pre-loved board games for the Baltic region',
  },
];

export const TWITTER_IMAGES = [OG_IMAGE_PATH];
