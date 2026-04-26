import { describe, it, expect } from 'vitest';
import { buildOrderTimeline, type OrderForTimeline, type TrackingEventForTimeline } from './timeline';

/** Minimal order with only required fields */
function makeOrder(overrides: Partial<OrderForTimeline> = {}): OrderForTimeline {
  return {
    status: 'pending_seller',
    created_at: '2026-04-01T10:00:00Z',
    accepted_at: null,
    shipped_at: null,
    delivered_at: null,
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function trackingEvent(
  state_type: string,
  event_timestamp: string,
  location?: string,
  event_type?: string
): TrackingEventForTimeline {
  return { event_type: event_type ?? state_type, state_type, event_timestamp, location };
}

describe('buildOrderTimeline', () => {
  it('pending_seller: shows ordered + future accepted', () => {
    const result = buildOrderTimeline(makeOrder(), []);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ key: 'ordered', isCurrent: true, isFuture: false });
    expect(result[1]).toMatchObject({ key: 'accepted', isFuture: true, timestamp: null });
  });

  it('happy path: milestones + tracking events interleave correctly', () => {
    const order = makeOrder({
      status: 'delivered',
      accepted_at: '2026-04-01T12:00:00Z',
      shipped_at: '2026-04-02T08:00:00Z',
      delivered_at: '2026-04-03T14:00:00Z',
    });
    const events = [
      trackingEvent('LABEL_CREATED', '2026-04-01T13:00:00Z'),
      trackingEvent('ON_THE_WAY', '2026-04-02T06:00:00Z'),
      trackingEvent('PARCEL_RECEIVED', '2026-04-02T18:00:00Z'),
      trackingEvent('PARCEL_DELIVERED', '2026-04-03T14:00:00Z'),
    ];

    const result = buildOrderTimeline(order, events);

    const keys = result.map((e) => e.key);
    // Should NOT have shipped/delivered milestones — tracking covers that phase
    expect(keys).not.toContain('shipped');
    expect(keys).not.toContain('delivered');
    expect(keys).toEqual([
      'ordered',
      'accepted',
      'ON_THE_WAY',
      'PARCEL_RECEIVED',
      'PARCEL_DELIVERED',
      'completed', // future
    ]);

    // Last past entry (PARCEL_DELIVERED) should be current
    const current = result.find((e) => e.isCurrent);
    expect(current?.key).toBe('PARCEL_DELIVERED');

    // Completed is future
    expect(result[result.length - 1]).toMatchObject({ key: 'completed', isFuture: true });
  });

  it('cancelled order: no future steps, ends at cancellation', () => {
    const order = makeOrder({
      status: 'cancelled',
      accepted_at: '2026-04-01T12:00:00Z',
      cancelled_at: '2026-04-01T14:00:00Z',
      cancellation_reason: 'declined',
    });

    const result = buildOrderTimeline(order, []);

    const keys = result.map((e) => e.key);
    expect(keys).toEqual(['ordered', 'accepted', 'cancelled']);
    expect(result.every((e) => !e.isFuture)).toBe(true);
    expect(result[2]).toMatchObject({
      key: 'cancelled',
      isCurrent: true,
      detail: 'The seller declined this order',
    });
  });

  it('accepted with LABEL_CREATED only: treated as no tracking, shows shipped future', () => {
    const order = makeOrder({
      status: 'accepted',
      accepted_at: '2026-04-01T12:00:00Z',
    });
    const events = [trackingEvent('LABEL_CREATED', '2026-04-01T13:00:00Z')];

    const result = buildOrderTimeline(order, events);

    const keys = result.map((e) => e.key);
    // LABEL_CREATED is filtered out (redundant with "Seller accepted" in T2T)
    // Falls back to milestone path: accepted is current, shipped is future
    expect(keys).toEqual(['ordered', 'accepted', 'shipped']);
    expect(result[1]).toMatchObject({ key: 'accepted', isCurrent: true });
    expect(result[2]).toMatchObject({ key: 'shipped', isFuture: true });
  });

  it('no tracking events: falls back to shipped/delivered milestones', () => {
    const order = makeOrder({
      status: 'delivered',
      accepted_at: '2026-04-01T12:00:00Z',
      shipped_at: '2026-04-02T08:00:00Z',
      delivered_at: '2026-04-03T14:00:00Z',
    });

    const result = buildOrderTimeline(order, []);

    const keys = result.map((e) => e.key);
    expect(keys).toEqual(['ordered', 'accepted', 'shipped', 'delivered', 'completed']);
    expect(result[4]).toMatchObject({ key: 'completed', isFuture: true });
    expect(result[3]).toMatchObject({ key: 'delivered', isCurrent: true });
  });

  it('PARCEL_CANCELED event: shown but does not affect milestones', () => {
    const order = makeOrder({
      status: 'accepted',
      accepted_at: '2026-04-01T12:00:00Z',
    });
    const events = [
      trackingEvent('LABEL_CREATED', '2026-04-01T13:00:00Z'),
      trackingEvent('PARCEL_CANCELED', '2026-04-01T15:00:00Z'),
    ];

    const result = buildOrderTimeline(order, events);

    const keys = result.map((e) => e.key);
    expect(keys).toContain('PARCEL_CANCELED');
    // Order is still accepted, tracking events exist with more than just LABEL_CREATED
    // so future completed is shown
    expect(keys).toContain('completed');
  });

  it('chronological sort: events from different sources sort correctly', () => {
    const order = makeOrder({
      status: 'shipped',
      accepted_at: '2026-04-01T12:00:00Z',
      shipped_at: '2026-04-02T08:00:00Z',
    });
    // Tracking events with timestamps interleaved with milestones
    const events = [
      trackingEvent('LABEL_CREATED', '2026-04-01T11:00:00Z'), // before accepted
      trackingEvent('ON_THE_WAY', '2026-04-02T06:00:00Z'),
      trackingEvent('PARCEL_RECEIVED', '2026-04-02T18:00:00Z'),
    ];

    const result = buildOrderTimeline(order, events);

    const timestamps = result.filter((e) => e.timestamp).map((e) => e.timestamp);
    // Verify chronological order
    for (let i = 1; i < timestamps.length; i++) {
      expect(new Date(timestamps[i]!).getTime()).toBeGreaterThanOrEqual(
        new Date(timestamps[i - 1]!).getTime()
      );
    }
    // Future entry is last
    expect(result[result.length - 1].isFuture).toBe(true);
  });

  it('cancelled with response_timeout: shows detail', () => {
    const order = makeOrder({
      status: 'cancelled',
      cancelled_at: '2026-04-01T14:00:00Z',
      cancellation_reason: 'response_timeout',
    });

    const result = buildOrderTimeline(order, []);
    const cancelled = result.find((e) => e.key === 'cancelled');
    expect(cancelled?.detail).toBe("The seller didn't respond in time");
  });

  it('cancelled with declined: shows detail', () => {
    const order = makeOrder({
      status: 'cancelled',
      cancelled_at: '2026-04-01T14:00:00Z',
      cancellation_reason: 'declined',
    });

    const result = buildOrderTimeline(order, []);
    const cancelled = result.find((e) => e.key === 'cancelled');
    expect(cancelled?.detail).toBe('The seller declined this order');
  });

  it('cancelled with null reason: no detail', () => {
    const order = makeOrder({
      status: 'cancelled',
      cancelled_at: '2026-04-01T14:00:00Z',
      cancellation_reason: null,
    });

    const result = buildOrderTimeline(order, []);
    const cancelled = result.find((e) => e.key === 'cancelled');
    expect(cancelled?.detail).toBeUndefined();
  });

  it('shipped fallback with no tracking: shows waiting detail', () => {
    const order = makeOrder({
      status: 'shipped',
      accepted_at: '2026-04-01T12:00:00Z',
      shipped_at: '2026-04-02T08:00:00Z',
    });

    const result = buildOrderTimeline(order, []);
    const shipped = result.find((e) => e.key === 'shipped');
    expect(shipped?.detail).toBe('Waiting for tracking updates');
  });

  it('completed order: all past, no futures', () => {
    const order = makeOrder({
      status: 'completed',
      accepted_at: '2026-04-01T12:00:00Z',
      shipped_at: '2026-04-02T08:00:00Z',
      delivered_at: '2026-04-03T14:00:00Z',
      completed_at: '2026-04-05T10:00:00Z',
    });
    const events = [
      trackingEvent('LABEL_CREATED', '2026-04-01T13:00:00Z'),
      trackingEvent('ON_THE_WAY', '2026-04-02T06:00:00Z'),
      trackingEvent('PARCEL_RECEIVED', '2026-04-02T18:00:00Z'),
      trackingEvent('PARCEL_DELIVERED', '2026-04-03T14:00:00Z'),
    ];

    const result = buildOrderTimeline(order, events);

    expect(result.every((e) => !e.isFuture)).toBe(true);
    expect(result[result.length - 1]).toMatchObject({ key: 'completed', isCurrent: true });
  });

  describe('granular Unisend event_type policy', () => {
    /** Mirrors the real production order 0dcfed09-1fe8-4f6e-9569-4079963359ec */
    function realWorldEvents(): TrackingEventForTimeline[] {
      return [
        trackingEvent('LABEL_CREATED', '2026-04-15T05:05:59Z', undefined, 'LABEL_CREATED'),
        trackingEvent(
          'PARCEL_RECEIVED',
          '2026-04-16T10:31:58Z',
          '9602 pakiautomaat, Häädemeeste uDrop Coop , Pärnu mnt 40, Häädemeeste, 86001',
          'ACCEPTED_TERMINAL'
        ),
        trackingEvent(
          'ON_THE_WAY',
          '2026-04-17T08:58:56Z',
          '9602 pakiautomaat, Häädemeeste uDrop Coop , Pärnu mnt 40, Häädemeeste, 86001',
          'RECEIVED_TERMINAL_OUT'
        ),
        trackingEvent('ON_THE_WAY', '2026-04-17T12:48:04Z', 'Tallinn', 'RECEIVED_LC'),
        trackingEvent('ON_THE_WAY', '2026-04-17T13:19:33Z', 'Tallinn', 'DELIVERY_TRANSFER'),
        trackingEvent('ON_THE_WAY', '2026-04-17T21:33:04Z', 'Rīga', 'RECEIVED_LC'),
        trackingEvent('ON_THE_WAY', '2026-04-18T03:05:55Z', 'Rīga', 'RECEIVED_TERMINAL'),
        trackingEvent('PARCEL_DELIVERED', '2026-04-18T08:56:25Z', 'Rīga', 'DELIVERY_DELIVERED'),
      ];
    }

    it('real-world delivered order: 7 timeline rows, hub events filtered, ETA suppressed after pickup', () => {
      const order = makeOrder({
        status: 'completed',
        accepted_at: '2026-04-15T05:05:00Z',
        completed_at: '2026-04-20T12:00:00Z',
        seller_country: 'EE',
        terminal_country: 'LV',
      });

      const result = buildOrderTimeline(order, realWorldEvents());
      const trackingEntries = result.filter((e) => e.type === 'tracking_event');

      expect(trackingEntries.map((e) => e.eventType)).toEqual([
        'ACCEPTED_TERMINAL',
        'RECEIVED_TERMINAL_OUT',
        'RECEIVED_TERMINAL',
        'DELIVERY_DELIVERED',
      ]);
      expect(result.map((e) => e.key)).toEqual([
        'ordered',
        'accepted',
        'PARCEL_RECEIVED',
        'ON_THE_WAY',
        'ON_THE_WAY',
        'PARCEL_DELIVERED',
        'completed',
      ]);
      // PARCEL_DELIVERED has fired → no ETA detail on any in-transit row.
      expect(trackingEntries.every((e) => e.detail === undefined)).toBe(true);
    });

    it('in-flight courier collection: ETA detail attaches to RECEIVED_TERMINAL_OUT', () => {
      const order = makeOrder({
        status: 'shipped',
        accepted_at: '2026-04-01T12:00:00Z',
        shipped_at: '2026-04-02T08:00:00Z',
        seller_country: 'EE',
        terminal_country: 'LV',
      });
      const events = [
        trackingEvent('PARCEL_RECEIVED', '2026-04-02T06:00:00Z', 'Häädemeeste', 'ACCEPTED_TERMINAL'),
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Häädemeeste', 'RECEIVED_TERMINAL_OUT'),
      ];

      const result = buildOrderTimeline(order, events);
      const courierCollection = result.find((e) => e.eventType === 'RECEIVED_TERMINAL_OUT');
      expect(courierCollection?.detail).toBe('Typically 2–3 working days');
    });

    it('domestic in-flight courier collection: detail reads "next working day"', () => {
      const order = makeOrder({
        status: 'shipped',
        accepted_at: '2026-04-01T12:00:00Z',
        shipped_at: '2026-04-02T08:00:00Z',
        seller_country: 'LV',
        terminal_country: 'LV',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Riga', 'RECEIVED_TERMINAL_OUT'),
      ];

      const result = buildOrderTimeline(order, events);
      const courierCollection = result.find((e) => e.eventType === 'RECEIVED_TERMINAL_OUT');
      expect(courierCollection?.detail).toBe('Typically next working day');
    });

    it('post-arrival: ETA suppressed once RECEIVED_TERMINAL has fired', () => {
      const order = makeOrder({
        status: 'delivered',
        accepted_at: '2026-04-01T12:00:00Z',
        seller_country: 'EE',
        terminal_country: 'LV',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Häädemeeste', 'RECEIVED_TERMINAL_OUT'),
        trackingEvent('ON_THE_WAY', '2026-04-03T07:00:00Z', 'Riga', 'RECEIVED_TERMINAL'),
      ];

      const result = buildOrderTimeline(order, events);
      const courierCollection = result.find((e) => e.eventType === 'RECEIVED_TERMINAL_OUT');
      expect(courierCollection?.detail).toBeUndefined();
    });

    it('countries missing on order: no ETA detail (defensive)', () => {
      const order = makeOrder({
        status: 'shipped',
        accepted_at: '2026-04-01T12:00:00Z',
        shipped_at: '2026-04-02T08:00:00Z',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Riga', 'RECEIVED_TERMINAL_OUT'),
      ];

      const result = buildOrderTimeline(order, events);
      const courierCollection = result.find((e) => e.eventType === 'RECEIVED_TERMINAL_OUT');
      expect(courierCollection?.detail).toBeUndefined();
    });

    it('hidden events filtered: RECEIVED_LC and DELIVERY_TRANSFER never appear', () => {
      const order = makeOrder({
        status: 'shipped',
        accepted_at: '2026-04-01T12:00:00Z',
        shipped_at: '2026-04-02T08:00:00Z',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T06:00:00Z', 'Tallinn', 'RECEIVED_LC'),
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Tallinn', 'DELIVERY_TRANSFER'),
      ];

      const result = buildOrderTimeline(order, events);
      const eventTypes = result.map((e) => e.eventType).filter(Boolean);
      expect(eventTypes).not.toContain('RECEIVED_LC');
      expect(eventTypes).not.toContain('DELIVERY_TRANSFER');
    });

    it('dedupes ready-for-pickup: NOTIFICATIONS_INFORMED hidden when RECEIVED_TERMINAL exists', () => {
      const order = makeOrder({
        status: 'delivered',
        accepted_at: '2026-04-01T12:00:00Z',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T06:00:00Z', 'Riga', 'RECEIVED_TERMINAL_OUT'),
        trackingEvent('ON_THE_WAY', '2026-04-02T20:00:00Z', 'Riga', 'RECEIVED_TERMINAL'),
        trackingEvent('ON_THE_WAY', '2026-04-02T20:05:00Z', 'Riga', 'NOTIFICATIONS_INFORMED'),
      ];

      const result = buildOrderTimeline(order, events);
      const eventTypes = result.map((e) => e.eventType).filter(Boolean);
      expect(eventTypes).toContain('RECEIVED_TERMINAL');
      expect(eventTypes).not.toContain('NOTIFICATIONS_INFORMED');
    });

    it('lone NOTIFICATIONS_INFORMED renders (defensive fallback when RECEIVED_TERMINAL missing)', () => {
      const order = makeOrder({
        status: 'delivered',
        accepted_at: '2026-04-01T12:00:00Z',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T06:00:00Z', 'Riga', 'RECEIVED_TERMINAL_OUT'),
        trackingEvent('ON_THE_WAY', '2026-04-02T20:05:00Z', 'Riga', 'NOTIFICATIONS_INFORMED'),
      ];

      const result = buildOrderTimeline(order, events);
      const eventTypes = result.map((e) => e.eventType).filter(Boolean);
      expect(eventTypes).toContain('NOTIFICATIONS_INFORMED');
    });

    it('drop-off location preserved on the entry: full terminal address survives so the renderer can extract a city', () => {
      const terminalAddress =
        '9602 pakiautomaat, Häädemeeste uDrop Coop , Pärnu mnt 40, Häädemeeste, 86001';
      const order = makeOrder({
        status: 'shipped',
        accepted_at: '2026-04-01T12:00:00Z',
        shipped_at: '2026-04-02T08:00:00Z',
      });
      const events = [
        trackingEvent('PARCEL_RECEIVED', '2026-04-02T06:00:00Z', terminalAddress, 'ACCEPTED_TERMINAL'),
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Häädemeeste', 'RECEIVED_TERMINAL_OUT'),
      ];

      const result = buildOrderTimeline(order, events);
      const dropOff = result.find((e) => e.eventType === 'ACCEPTED_TERMINAL');
      expect(dropOff?.location).toBe(terminalAddress);
    });

    it('unknown granular event_type within ON_THE_WAY: rendered, not filtered', () => {
      const order = makeOrder({
        status: 'shipped',
        accepted_at: '2026-04-01T12:00:00Z',
        shipped_at: '2026-04-02T08:00:00Z',
      });
      const events = [
        trackingEvent('ON_THE_WAY', '2026-04-02T07:00:00Z', 'Tallinn', 'FUTURE_NEW_TYPE'),
      ];

      const result = buildOrderTimeline(order, events);
      const eventTypes = result.map((e) => e.eventType).filter(Boolean);
      expect(eventTypes).toContain('FUTURE_NEW_TYPE');
    });
  });
});
