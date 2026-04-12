import { describe, it, expect } from 'vitest';
import { buildListingJsonLd, type ListingJsonLdInput } from './listing-json-ld';

const BASE_URL = 'https://secondturn.games';

function makeInput(overrides: Partial<ListingJsonLdInput> = {}): ListingJsonLdInput {
  return {
    id: 'abc-123',
    title: 'Catan',
    priceCents: 1629,
    status: 'active',
    conditionLabel: 'Very Good',
    sellerNotes: null,
    imageUrls: [],
    publisher: null,
    sellerName: 'Jane',
    sellerCountry: 'LV',
    isAuction: false,
    currentBidCents: null,
    ...overrides,
  };
}

describe('buildListingJsonLd', () => {
  it('returns valid Product JSON-LD for active listing', () => {
    const result = buildListingJsonLd(makeInput(), BASE_URL);
    expect(result).not.toBeNull();
    expect(result!['@type']).toBe('Product');
    expect(result!.name).toBe('Catan');
    expect(result!.url).toBe(`${BASE_URL}/listings/abc-123`);
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.availability).toBe('https://schema.org/InStock');
    expect(offers.priceCurrency).toBe('EUR');
  });

  it('returns LimitedAvailability for reserved listing', () => {
    const result = buildListingJsonLd(makeInput({ status: 'reserved' }), BASE_URL);
    expect(result).not.toBeNull();
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.availability).toBe('https://schema.org/LimitedAvailability');
  });

  it('returns null for sold listing', () => {
    expect(buildListingJsonLd(makeInput({ status: 'sold' }), BASE_URL)).toBeNull();
  });

  it('returns null for cancelled listing', () => {
    expect(buildListingJsonLd(makeInput({ status: 'cancelled' }), BASE_URL)).toBeNull();
  });

  it('formats price correctly from integer cents', () => {
    const cases: [number, string][] = [
      [1629, '16.29'],
      [741, '7.41'],
      [10000, '100.00'],
      [50, '0.50'],
    ];
    for (const [cents, expected] of cases) {
      const result = buildListingJsonLd(makeInput({ priceCents: cents }), BASE_URL);
      const offers = result!.offers as Record<string, unknown>;
      expect(offers.price).toBe(expected);
    }
  });

  it('omits brand when publisher is null', () => {
    const result = buildListingJsonLd(makeInput({ publisher: null }), BASE_URL);
    expect(result!.brand).toBeUndefined();
  });

  it('includes brand when publisher is present', () => {
    const result = buildListingJsonLd(makeInput({ publisher: 'Kosmos' }), BASE_URL);
    expect(result!.brand).toEqual({ '@type': 'Brand', name: 'Kosmos' });
  });

  it('omits image when imageUrls is empty', () => {
    const result = buildListingJsonLd(makeInput({ imageUrls: [] }), BASE_URL);
    expect(result!.image).toBeUndefined();
  });

  it('includes images when present', () => {
    const urls = ['https://storage.example.com/photo1.jpg', 'https://bgg.example.com/cover.jpg'];
    const result = buildListingJsonLd(makeInput({ imageUrls: urls }), BASE_URL);
    expect(result!.image).toEqual(urls);
  });

  it('includes seller notes in description, capped at 200 chars', () => {
    const longNotes = 'A'.repeat(300);
    const result = buildListingJsonLd(makeInput({ sellerNotes: longNotes }), BASE_URL);
    expect((result!.description as string).length).toBeLessThanOrEqual(200);
    expect(result!.description).toContain('Pre-loved board game in Very Good condition');
  });

  it('uses current bid as price for auction listings', () => {
    const result = buildListingJsonLd(makeInput({
      isAuction: true,
      priceCents: 1000,
      currentBidCents: 2500,
    }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.price).toBe('25.00');
  });

  it('uses starting price when auction has no bids', () => {
    const result = buildListingJsonLd(makeInput({
      isAuction: true,
      priceCents: 1000,
      currentBidCents: null,
    }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.price).toBe('10.00');
  });

  it('handles XSS in title without breaking', () => {
    const result = buildListingJsonLd(makeInput({ title: '<script>alert("xss")</script>' }), BASE_URL);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('<script>alert("xss")</script>');
  });

  it('uses listing price for bundle listings (not bundle retail price)', () => {
    const result = buildListingJsonLd(makeInput({ priceCents: 3500 }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.price).toBe('35.00');
  });

  it('includes shippingDetails for Baltic seller', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: 'LV' }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    const shipping = offers.shippingDetails as Record<string, unknown>[];
    expect(shipping).toHaveLength(3);

    // Verify rates match SHIPPING_PRICES_CENTS for LV origin
    const byDest = Object.fromEntries(
      shipping.map((s) => {
        const dest = (s.shippingDestination as Record<string, unknown>).addressCountry;
        const rate = (s.shippingRate as Record<string, unknown>).value;
        return [dest, rate];
      })
    );
    expect(byDest.LV).toBe('1.90');
    expect(byDest.LT).toBe('2.10');
    expect(byDest.EE).toBe('2.10');
  });

  it('uses correct transit times for domestic vs cross-border', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: 'LV' }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    const shipping = offers.shippingDetails as Record<string, unknown>[];

    const findDest = (country: string) =>
      shipping.find((s) => (s.shippingDestination as Record<string, unknown>).addressCountry === country)!;

    // Domestic: 1-3 days
    const domestic = (findDest('LV').deliveryTime as Record<string, unknown>).transitTime as Record<string, unknown>;
    expect(domestic.minValue).toBe(1);
    expect(domestic.maxValue).toBe(3);

    // Cross-border: 2-5 days
    const crossBorder = (findDest('LT').deliveryTime as Record<string, unknown>).transitTime as Record<string, unknown>;
    expect(crossBorder.minValue).toBe(2);
    expect(crossBorder.maxValue).toBe(5);
  });

  it('includes handlingTime 0-5 days on shipping details', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: 'LV' }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    const shipping = offers.shippingDetails as Record<string, unknown>[];

    for (const entry of shipping) {
      const handling = (entry.deliveryTime as Record<string, unknown>).handlingTime as Record<string, unknown>;
      expect(handling['@type']).toBe('QuantitativeValue');
      expect(handling.minValue).toBe(0);
      expect(handling.maxValue).toBe(5);
      expect(handling.unitCode).toBe('DAY');
    }
  });

  it('includes hasMerchantReturnPolicy with 2-day window', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: 'LV' }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    const policy = offers.hasMerchantReturnPolicy as Record<string, unknown>;
    expect(policy['@type']).toBe('MerchantReturnPolicy');
    expect(policy.returnPolicyCategory).toBe('https://schema.org/MerchantReturnFiniteReturnWindow');
    expect(policy.merchantReturnDays).toBe(2);
    expect(policy.applicableCountry).toBe('LV');
  });

  it('omits shipping and return policy when sellerCountry is null', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: null }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.shippingDetails).toBeUndefined();
    expect(offers.hasMerchantReturnPolicy).toBeUndefined();
  });

  it('omits shipping and return policy when sellerCountry is non-Baltic', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: 'DE' }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    expect(offers.shippingDetails).toBeUndefined();
    expect(offers.hasMerchantReturnPolicy).toBeUndefined();
  });

  it('includes all three destination countries in shippingDetails', () => {
    const result = buildListingJsonLd(makeInput({ sellerCountry: 'EE' }), BASE_URL);
    const offers = result!.offers as Record<string, unknown>;
    const shipping = offers.shippingDetails as Record<string, unknown>[];
    const destinations = shipping.map(
      (s) => (s.shippingDestination as Record<string, unknown>).addressCountry
    );
    expect(destinations).toContain('LT');
    expect(destinations).toContain('LV');
    expect(destinations).toContain('EE');
  });
});
