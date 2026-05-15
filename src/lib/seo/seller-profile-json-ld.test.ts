import { describe, it, expect } from 'vitest';
import { buildSellerProfileJsonLd } from './seller-profile-json-ld';

describe('buildSellerProfileJsonLd', () => {
  it('returns a ProfilePage with Person mainEntity', () => {
    const result = buildSellerProfileJsonLd({
      name: 'Jane',
      avatarUrl: 'https://example.com/avatar.jpg',
      country: 'LV',
    });
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('ProfilePage');
    const person = result.mainEntity as Record<string, unknown>;
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('Jane');
    expect(person.image).toBe('https://example.com/avatar.jpg');
    expect(person.address).toEqual({ '@type': 'PostalAddress', addressCountry: 'LV' });
  });

  it('omits the image key when avatarUrl is null (not "image": null)', () => {
    const result = buildSellerProfileJsonLd({
      name: 'Jane',
      avatarUrl: null,
      country: 'LV',
    });
    const person = result.mainEntity as Record<string, unknown>;
    expect('image' in person).toBe(false);
  });

  it('omits the address key when country is null (not "address": null)', () => {
    const result = buildSellerProfileJsonLd({
      name: 'Jane',
      avatarUrl: 'https://example.com/avatar.jpg',
      country: null,
    });
    const person = result.mainEntity as Record<string, unknown>;
    expect('address' in person).toBe(false);
  });
});
