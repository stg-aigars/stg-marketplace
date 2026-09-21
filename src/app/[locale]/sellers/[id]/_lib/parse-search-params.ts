export type SellerProfileTab = 'profile' | 'reviews' | 'listings';

/**
 * Validates raw searchParams into a tab/page pair. Unknown or missing `tab`
 * values default to 'profile' — this is what makes every un-hashed external
 * link to /sellers/[id] and the JSON-LD canonical URL land correctly.
 */
export function parseSellerProfileSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): { activeTab: SellerProfileTab; requestedPage: number } {
  const rawTab = searchParams.tab;
  const activeTab: SellerProfileTab =
    rawTab === 'reviews' ? 'reviews' : rawTab === 'listings' ? 'listings' : 'profile';

  const rawPage = searchParams.page;
  const parsedPage = typeof rawPage === 'string' ? parseInt(rawPage, 10) : NaN;
  const requestedPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return { activeTab, requestedPage };
}
