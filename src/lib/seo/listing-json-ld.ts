import type { WithContext, Product, ItemAvailability } from 'schema-dts';
import { SHIPPING_PRICES_CENTS, TERMINAL_COUNTRIES, isTerminalCountry } from '@/lib/services/unisend/types';
import type { TerminalCountry } from '@/lib/services/unisend/types';

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

function buildShippingDetails(sellerCountry: TerminalCountry) {
  return TERMINAL_COUNTRIES.map((dest) => {
    const isDomestic = sellerCountry === dest;
    const priceCents = SHIPPING_PRICES_CENTS[sellerCountry][dest];
    return {
      '@type': 'OfferShippingDetails' as const,
      shippingRate: {
        '@type': 'MonetaryAmount' as const,
        value: (priceCents / 100).toFixed(2),
        currency: 'EUR',
      },
      shippingDestination: {
        '@type': 'DefinedRegion' as const,
        addressCountry: dest,
      },
      shippingOrigin: {
        '@type': 'DefinedRegion' as const,
        addressCountry: sellerCountry,
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime' as const,
        handlingTime: {
          '@type': 'QuantitativeValue' as const,
          minValue: 0,
          maxValue: 5,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue' as const,
          minValue: isDomestic ? 1 : 2,
          maxValue: isDomestic ? 3 : 5,
          unitCode: 'DAY',
        },
      },
    };
  });
}

function buildReturnPolicy(sellerCountry: string) {
  return {
    '@type': 'MerchantReturnPolicy' as const,
    applicableCountry: sellerCountry,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow' as const,
    merchantReturnDays: 2,
  };
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
      ...(input.sellerCountry && isTerminalCountry(input.sellerCountry)
        ? {
            shippingDetails: buildShippingDetails(input.sellerCountry),
            hasMerchantReturnPolicy: buildReturnPolicy(input.sellerCountry),
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
