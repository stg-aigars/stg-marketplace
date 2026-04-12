import type { WithContext, Product, ItemAvailability } from 'schema-dts';
import { SHIPPING_PRICES_CENTS, TERMINAL_COUNTRIES, isTerminalCountry, type TerminalCountry } from '@/lib/services/unisend/types';

const SCHEMA_ITEM_CONDITION = 'https://schema.org/UsedCondition' as const;

// Google also requests `review` and `aggregateRating`, but our rating system
// is binary (thumbs up/down) and per-seller, not per-product — doesn't map
// to schema.org's 1-5 star Rating. Omitted intentionally.

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
  sellerCountry: string | null;
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

// Precomputed at module load — all inputs are static (3 origins × 3 destinations)
const SHIPPING_DETAILS = Object.fromEntries(
  TERMINAL_COUNTRIES.map((origin) => [
    origin,
    TERMINAL_COUNTRIES.map((dest) => {
      const isDomestic = origin === dest;
      return {
        '@type': 'OfferShippingDetails' as const,
        shippingRate: {
          '@type': 'MonetaryAmount' as const,
          value: (SHIPPING_PRICES_CENTS[origin][dest] / 100).toFixed(2),
          currency: 'EUR',
        },
        shippingDestination: { '@type': 'DefinedRegion' as const, addressCountry: dest },
        shippingOrigin: { '@type': 'DefinedRegion' as const, addressCountry: origin },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime' as const,
          handlingTime: { '@type': 'QuantitativeValue' as const, minValue: 0, maxValue: 5, unitCode: 'DAY' },
          transitTime: {
            '@type': 'QuantitativeValue' as const,
            minValue: isDomestic ? 1 : 2,
            maxValue: isDomestic ? 3 : 5,
            unitCode: 'DAY',
          },
        },
      };
    }),
  ])
) as unknown as Record<TerminalCountry, readonly object[]>;

const RETURN_POLICY = Object.fromEntries(
  TERMINAL_COUNTRIES.map((country) => [
    country,
    {
      '@type': 'MerchantReturnPolicy' as const,
      applicableCountry: country,
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow' as const,
      merchantReturnDays: 2,
    },
  ])
) as unknown as Record<TerminalCountry, object>;

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
      ...(input.sellerCountry && isTerminalCountry(input.sellerCountry)
        ? {
            shippingDetails: SHIPPING_DETAILS[input.sellerCountry],
            hasMerchantReturnPolicy: RETURN_POLICY[input.sellerCountry],
          }
        : {}),
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
