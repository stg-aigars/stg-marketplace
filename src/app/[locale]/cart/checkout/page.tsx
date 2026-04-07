import { redirect } from 'next/navigation';

/**
 * Redirect shim: /cart/checkout → /checkout
 * Forwards seller and error query params.
 */
export default async function CartCheckoutRedirect({
  searchParams,
}: {
  searchParams: Promise<{ seller?: string; error?: string }>;
}) {
  const params = await searchParams;
  const queryParts: string[] = [];
  if (params.seller) queryParts.push(`seller=${params.seller}`);
  if (params.error) queryParts.push(`error=${params.error}`);
  const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  redirect(`/checkout${query}`);
}
