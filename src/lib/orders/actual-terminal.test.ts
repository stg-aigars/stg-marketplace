import { describe, it, expect } from 'vitest';
import {
  parseActualDeliveryTerminal,
  getActualDeliveryTerminal,
} from './actual-terminal';
import type { TrackingEventForTimeline } from './timeline';

describe('parseActualDeliveryTerminal', () => {
  it('parses LV RECEIVED_TERMINAL location with postal prefix', () => {
    const result = parseActualDeliveryTerminal(
      '8541 pakomāts, NICE HOME (Udrop), Nīcgales iela 18A, Rīga, LV-1035'
    );
    expect(result).toEqual({
      terminalId: '8541',
      name: 'NICE HOME (Udrop)',
      city: 'Rīga',
    });
  });

  it('parses EE RECEIVED_TERMINAL location with numeric postal', () => {
    const result = parseActualDeliveryTerminal(
      '9602 pakiautomaat, Häädemeeste uDrop Coop, Pärnu mnt 40, Häädemeeste, 86001'
    );
    expect(result).toEqual({
      terminalId: '9602',
      name: 'Häädemeeste uDrop Coop',
      city: 'Häädemeeste',
    });
  });

  it('returns null for transit-hub scans that only carry a city', () => {
    expect(parseActualDeliveryTerminal('Rīga')).toBeNull();
  });

  it('returns null for null/empty input', () => {
    expect(parseActualDeliveryTerminal(null)).toBeNull();
    expect(parseActualDeliveryTerminal(undefined)).toBeNull();
    expect(parseActualDeliveryTerminal('')).toBeNull();
  });

  it('returns null when the leading token is not numeric', () => {
    expect(parseActualDeliveryTerminal('pakomāts, X, Y, Rīga, LV-1035')).toBeNull();
  });

  it('omits city when only the name is present', () => {
    expect(parseActualDeliveryTerminal('8541 pakomāts, NICE HOME')).toEqual({
      terminalId: '8541',
      name: 'NICE HOME',
      city: null,
    });
  });
});

describe('getActualDeliveryTerminal', () => {
  function event(
    event_type: string,
    event_timestamp: string,
    location: string | null
  ): TrackingEventForTimeline {
    return { event_type, state_type: event_type, event_timestamp, location };
  }

  it('returns null when there is no RECEIVED_TERMINAL or NOTIFICATIONS_INFORMED', () => {
    const events = [
      event('LABEL_CREATED', '2026-05-21T07:00:00Z', null),
      event('RECEIVED_LC', '2026-05-21T16:00:00Z', 'Rīga'),
    ];
    expect(getActualDeliveryTerminal(events)).toBeNull();
  });

  it('parses RECEIVED_TERMINAL when present', () => {
    const events = [
      event('LABEL_CREATED', '2026-05-21T07:00:00Z', null),
      event(
        'RECEIVED_TERMINAL',
        '2026-05-22T11:28:00Z',
        '8541 pakomāts, NICE HOME (Udrop), Nīcgales iela 18A, Rīga, LV-1035'
      ),
    ];
    expect(getActualDeliveryTerminal(events)?.terminalId).toBe('8541');
  });

  it('falls back to NOTIFICATIONS_INFORMED when RECEIVED_TERMINAL is missing', () => {
    const events = [
      event(
        'NOTIFICATIONS_INFORMED',
        '2026-05-22T11:30:00Z',
        '8541 pakomāts, NICE HOME (Udrop), Nīcgales iela 18A, Rīga, LV-1035'
      ),
    ];
    expect(getActualDeliveryTerminal(events)?.terminalId).toBe('8541');
  });

  it('prefers the most recent destination scan', () => {
    const events = [
      event(
        'RECEIVED_TERMINAL',
        '2026-05-22T11:28:00Z',
        '8541 pakomāts, NICE HOME (Udrop), Nīcgales iela 18A, Rīga, LV-1035'
      ),
      event(
        'NOTIFICATIONS_INFORMED',
        '2026-05-22T12:00:00Z',
        '8079 pakomāts, Minska, Nīcgales iela 2A, Rīga, LV-1035'
      ),
    ];
    expect(getActualDeliveryTerminal(events)?.terminalId).toBe('8079');
  });

  it('skips unparseable locations and tries earlier scans', () => {
    const events = [
      event('NOTIFICATIONS_INFORMED', '2026-05-22T12:00:00Z', 'Rīga'),
      event(
        'RECEIVED_TERMINAL',
        '2026-05-22T11:28:00Z',
        '8541 pakomāts, NICE HOME (Udrop), Nīcgales iela 18A, Rīga, LV-1035'
      ),
    ];
    expect(getActualDeliveryTerminal(events)?.terminalId).toBe('8541');
  });
});
