export type SellerProfileTab = 'profile' | 'reviews' | 'listings';

/**
 * Validates raw searchParams into a tab/page pair. Unknown or missing `tab`
 * values default to 'listings' — this is what makes every un-hashed external
 * link to /sellers/[id] and the JSON-LD canonical URL land correctly, and
 * matches Listings being the default/first tab.
 */
export function parseSellerProfileSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): { activeTab: SellerProfileTab; requestedPage: number } {
  const rawTab = searchParams.tab;
  const activeTab: SellerProfileTab =
    rawTab === 'profile' ? 'profile' : rawTab === 'reviews' ? 'reviews' : 'listings';

  const rawPage = searchParams.page;
  const parsedPage = typeof rawPage === 'string' ? parseInt(rawPage, 10) : NaN;
  const requestedPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return { activeTab, requestedPage };
}
