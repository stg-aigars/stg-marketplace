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
  location?: string
): TrackingEventForTimeline {
  return { state_type, event_timestamp, location };
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
      'LABEL_CREATED',
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

  it('accepted with LABEL_CREATED only: shows it inline, no extra futures', () => {
    const order = makeOrder({
      status: 'accepted',
      accepted_at: '2026-04-01T12:00:00Z',
    });
    const events = [trackingEvent('LABEL_CREATED', '2026-04-01T13:00:00Z')];

    const result = buildOrderTimeline(order, events);

    const keys = result.map((e) => e.key);
    expect(keys).toEqual(['ordered', 'accepted', 'LABEL_CREATED']);
    // No future step — next real event appears when it happens
    expect(result.every((e) => !e.isFuture)).toBe(true);
    expect(result[2]).toMatchObject({ key: 'LABEL_CREATED', isCurrent: true });
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
});
