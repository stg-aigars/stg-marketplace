import type { Metadata } from 'next';
import { OG_IMAGES, TWITTER_IMAGES } from './og';

const SITE_NAME = 'Second Turn Games';

type OgImage = { url: string; width?: number; height?: number; alt?: string };

export interface PageMetadataInput {
  /** Page title. The root layout's `%s | Second Turn Games` template applies to <title>. */
  title: string;
  description: string;
  /**
   * Canonical path, relative to metadataBase. Pass the bare path with no
   * query string: filtered, searched and paginated variants of a page
   * (e.g. /browse?q=catan&page=2) all canonicalize to the plain page. Listings
   * themselves are discovered via sitemap.xml, not pagination.
   */
  path: string;
  /** Share-card title. Defaults to `${title} | Second Turn Games` (og/twitter don't apply the title template). */
  socialTitle?: string;
  /** Share-card description. Defaults to `description`. */
  socialDescription?: string;
  /** Share-card images. Defaults to the site-wide OG image. */
  images?: OgImage[];
  /** og:type. Defaults to 'website'. */
  type?: 'website' | 'article' | 'profile';
}

/**
 * Builds per-page metadata with a canonical URL and complete OpenGraph and
 * Twitter cards.
 *
 * Why this exists: Next.js replaces `openGraph` and `twitter` wholesale per
 * route segment (no deep merge). A page that sets only `title`/`description`
 * therefore shares the root layout's generic card, and the layout's og:url
 * points every page at the homepage. A page that sets a partial `openGraph`
 * loses the default image. This helper always emits the full set.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  socialTitle,
  socialDescription,
  images,
  type = 'website',
}: PageMetadataInput): Metadata {
  if (!path.startsWith('/') || path.includes('?') || path.includes('#')) {
    throw new Error(`buildPageMetadata: path must be a bare absolute path, got "${path}"`);
  }

  const cardTitle = socialTitle ?? `${title} | ${SITE_NAME}`;
  const cardDescription = socialDescription ?? description;
  const ogImages = images && images.length > 0 ? images : OG_IMAGES;
  const twitterImages = images && images.length > 0 ? images.map((i) => i.url) : TWITTER_IMAGES;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: cardTitle,
      description: cardDescription,
      url: path,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: cardTitle,
      description: cardDescription,
      images: twitterImages,
    },
  };
}
