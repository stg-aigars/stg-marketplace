import { redirect } from 'next/navigation';

/**
 * Redirect shim for old checkout URLs.
 *
 * Email links and bookmarks may point to /checkout/{listingId}.
 * Redirect auction winners to the listing page (where BidPanel "Pay now" adds to cart).
 * Non-auction listings redirect to /cart.
 */
export default async function LegacyCheckoutRedirect(
  props: {
    params: Promise<{ listingId: string; locale: string }>;
  }
) {
  const { listingId, locale } = await props.params;
  redirect(`/${locale}/listings/${listingId}`);
}
