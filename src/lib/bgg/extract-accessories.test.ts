import { describe, it, expect } from 'vitest';
import { extractAccessories } from './api';
import type { BGGGameMetadata, BGGInboundLink } from './types';

function link(partial: Partial<BGGInboundLink>): BGGInboundLink {
  return { id: '1', type: 'boardgameaccessory', value: 'Accessory', inbound: false, ...partial };
}

function metadata(links: BGGInboundLink[], inbound: BGGInboundLink[] = []): BGGGameMetadata {
  return {
    id: 1,
    name: 'Test Game',
    type: 'boardgame',
    inboundLinks: inbound,
    outboundLinks: links,
  };
}

describe('extractAccessories', () => {
  it('extracts boardgameaccessory links, ignoring other link types', () => {
    const meta = metadata([
      link({ id: '100', type: 'boardgameaccessory', value: 'Metal Coins' }),
      link({ id: '200', type: 'boardgamemechanic', value: 'Hand Management' }),
      link({ id: '300', type: 'boardgameaccessory', value: 'Folded Space Insert' }),
    ]);
    expect(extractAccessories(meta)).toEqual([
      { id: 300, name: 'Folded Space Insert' },
      { id: 100, name: 'Metal Coins' },
    ]);
  });

  it('scans both inbound and outbound links (accessories carry no inbound flag)', () => {
    const meta = metadata(
      [link({ id: '100', value: 'Outbound Accessory' })],
      [link({ id: '200', value: 'Inbound Accessory', inbound: true })]
    );
    expect(extractAccessories(meta).map((a) => a.id).sort()).toEqual([100, 200]);
  });

  it('decodes HTML entities in accessory names', () => {
    const meta = metadata([link({ id: '100', value: 'Gaming Trunk Character&#039;s Tray' })]);
    expect(extractAccessories(meta)[0].name).toBe("Gaming Trunk Character's Tray");
  });

  it('dedupes by id', () => {
    const meta = metadata([
      link({ id: '100', value: 'Metal Coins' }),
      link({ id: '100', value: 'Metal Coins (dup)' }),
    ]);
    expect(extractAccessories(meta)).toHaveLength(1);
  });

  it('drops malformed ids and empty names', () => {
    const meta = metadata([
      link({ id: 'not-a-number', value: 'Bad Id' }),
      link({ id: '0', value: 'Zero Id' }),
      link({ id: '100', value: '   ' }),
      link({ id: '200', value: 'Valid' }),
    ]);
    expect(extractAccessories(meta)).toEqual([{ id: 200, name: 'Valid' }]);
  });

  it('returns alphabetically sorted names', () => {
    const meta = metadata([
      link({ id: '1', value: 'Zebra Insert' }),
      link({ id: '2', value: 'Apple Tokens' }),
      link({ id: '3', value: 'Mango Coins' }),
    ]);
    expect(extractAccessories(meta).map((a) => a.name)).toEqual([
      'Apple Tokens',
      'Mango Coins',
      'Zebra Insert',
    ]);
  });
});
