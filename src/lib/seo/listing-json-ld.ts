import type { WithContext, Product, ItemAvailability } from 'schema-dts';

const SCHEMA_ITEM_CONDITION = 'https://schema.org/UsedCondition' as const;

export interface ListingJsonLdInput {
  id: string;
  title: string;
  priceCents: number;
  status: string;
  conditionLabel: string;
  sellerNotes: string | null;
  imageUrls: string[];
  publisher: string | null;
  sellerName: string;
  isAuction: boolean;
  currentBidCents: number | null;
}

function getSchemaAvailability(status: string): ItemAvailability | null {
  switch (status) {
    case 'active':
      return 'https://schema.org/InStock';
    case 'reserved':
      return 'https://schema.org/LimitedAvailability';
    default:
      return null;
  }
}

export function buildListingJsonLd(
  input: ListingJsonLdInput,
  baseUrl: string
): WithContext<Product> | null {
  const availability = getSchemaAvailability(input.status);
  if (!availability) return null;

  const priceCents = input.isAuction && input.currentBidCents !== null
    ? input.currentBidCents
    : input.priceCents;
  const price = (priceCents / 100).toFixed(2);

  const descriptionParts = [`Pre-loved board game in ${input.conditionLabel} condition`];
  if (input.sellerNotes) {
    descriptionParts.push(input.sellerNotes);
  }
  const description = descriptionParts.join('. ').slice(0, 200);

  const jsonLd: WithContext<Product> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.title,
    description,
    sku: input.id,
    url: `${baseUrl}/listings/${input.id}`,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/listings/${input.id}`,
      priceCurrency: 'EUR',
      price,
      itemCondition: SCHEMA_ITEM_CONDITION,
      availability,
      ...(input.sellerName ? { seller: { '@type': 'Person', name: input.sellerName } } : {}),
    } as WithContext<Product>['offers'],
  };

  if (input.imageUrls.length > 0) {
    jsonLd.image = input.imageUrls;
  }

  if (input.publisher) {
    jsonLd.brand = {
      '@type': 'Brand',
      name: input.publisher,
    };
  }

  return jsonLd;
}
