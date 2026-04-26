// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UnifiedTimeline } from './UnifiedTimeline';
import type { TrackingEventRow } from '@/lib/services/tracking';

const baseOrder = {
  status: 'delivered' as const,
  created_at: '2026-04-15T05:00:00Z',
  accepted_at: '2026-04-15T05:05:00Z',
  shipped_at: '2026-04-16T10:31:58Z',
  delivered_at: '2026-04-18T08:56:25Z',
  completed_at: null,
  cancelled_at: null,
  seller_country: 'EE' as const,
  destination_country: 'LV' as const,
};

function trackingEvent(
  state_type: string,
  event_type: string,
  event_timestamp: string,
  location: string | null = null
): TrackingEventRow {
  return {
    event_type,
    state_type,
    state_text: null,
    location,
    event_timestamp,
  };
}

describe('UnifiedTimeline two-line rendering', () => {
  afterEach(cleanup);

  it('ACCEPTED_TERMINAL: extracts city, appends seller country flag, no full-address line', () => {
    const { container } = render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent(
            'PARCEL_RECEIVED',
            'ACCEPTED_TERMINAL',
            '2026-04-16T10:31:58Z',
            '9602 pakiautomaat, Häädemeeste uDrop Coop, Pärnu mnt 40, Häädemeeste, 86001'
          ),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText(/Dropped off at terminal in Häädemeeste/)).toBeDefined();
    // Seller country (EE) flag span renders inline next to the label
    expect(container.querySelector('.fi.fi-ee')).not.toBeNull();
    // No separate location line — the full address is not rendered as its own row
    expect(
      screen.queryByText(
        '9602 pakiautomaat, Häädemeeste uDrop Coop, Pärnu mnt 40, Häädemeeste, 86001'
      )
    ).toBeNull();
  });

  it('ACCEPTED_TERMINAL: falls back to plain label when location is unparseable', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('PARCEL_RECEIVED', 'ACCEPTED_TERMINAL', '2026-04-16T10:31:58Z', null),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('Dropped off at terminal')).toBeDefined();
  });

  it('RECEIVED_TERMINAL_OUT: renders "Collected by courier" with no location appended', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL_OUT', '2026-04-17T08:58:56Z', 'Häädemeeste'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('Collected by courier')).toBeDefined();
    // The event location ("Häädemeeste") is intentionally suppressed for this row — it would
    // duplicate the drop-off row above it.
    expect(screen.queryByText('Häädemeeste')).toBeNull();
    expect(screen.queryByText('In transit')).toBeNull();
  });

  it('RECEIVED_TERMINAL with terminal name containing city: omits redundant city, appends destination flag', () => {
    const { container } = render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL', '2026-04-18T03:05:55Z', 'Rīga'),
        ]}
        trackingUrl={null}
        destinationTerminal="Rīga LSE Park"
        destinationCity="Rīga"
      />
    );

    expect(screen.getByText(/Ready for pickup at Rīga LSE Park/)).toBeDefined();
    // City "Rīga" already appears inside terminal name → not appended a second time
    expect(screen.queryByText(/Rīga LSE Park, Rīga/)).toBeNull();
    // Destination country (LV) flag span renders inline
    expect(container.querySelector('.fi.fi-lv')).not.toBeNull();
  });

  it('RECEIVED_TERMINAL with terminal name lacking city: appends ", <city>" before flag', () => {
    const { container } = render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL', '2026-04-18T03:05:55Z', 'Rīga'),
        ]}
        trackingUrl={null}
        destinationTerminal="Circle K (Latvijas Pasts)"
        destinationCity="Rīga"
      />
    );

    expect(screen.getByText(/Ready for pickup at Circle K \(Latvijas Pasts\), Rīga/)).toBeDefined();
    expect(container.querySelector('.fi.fi-lv')).not.toBeNull();
  });

  it('regression: NOTIFICATIONS_INFORMED with no destinationTerminal falls back to "Ready for pickup"', () => {
    // Some Unisend routes deliver NOTIFICATIONS_INFORMED without a prior RECEIVED_TERMINAL, and
    // some orders ship without a stored terminal_name. This is the load-bearing path for that
    // case — do not delete as redundant with the override-map tests above.
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'NOTIFICATIONS_INFORMED', '2026-04-18T03:05:55Z', 'Rīga'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('Ready for pickup')).toBeDefined();
  });

  it('regression: RECEIVED_TERMINAL with no destinationTerminal falls back to "Ready for pickup"', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL', '2026-04-18T03:05:55Z', 'Rīga'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('Ready for pickup')).toBeDefined();
  });

  it('DELIVERY_DELIVERED: renders "Picked up" with no location appended', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('PARCEL_DELIVERED', 'DELIVERY_DELIVERED', '2026-04-18T08:56:25Z', 'Rīga'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('Picked up')).toBeDefined();
    expect(screen.queryByText('Picked up · Rīga')).toBeNull();
  });

  it('unknown granular ON_THE_WAY: falls through to "In transit · <location>" middle-dot format', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'FUTURE_NEW_TYPE', '2026-04-17T15:48:00Z', 'Tallinn'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('In transit · Tallinn')).toBeDefined();
  });

  it('cancelled milestone: cancellation reason is inlined into the label', () => {
    const cancelledOrder = {
      ...baseOrder,
      status: 'cancelled' as const,
      delivered_at: null,
      shipped_at: null,
      cancelled_at: '2026-04-15T08:00:00Z',
      cancellation_reason: 'declined' as const,
    };
    render(<UnifiedTimeline order={cancelledOrder} trackingEvents={[]} trackingUrl={null} />);

    expect(screen.getByText('Order cancelled: the seller declined this order')).toBeDefined();
  });

  it('shipped milestone fallback (no tracking): "waiting for tracking updates" is inlined', () => {
    const shippedOrder = {
      ...baseOrder,
      status: 'shipped' as const,
      delivered_at: null,
      shipped_at: '2026-04-16T10:31:58Z',
    };
    render(<UnifiedTimeline order={shippedOrder} trackingEvents={[]} trackingUrl={null} />);

    expect(screen.getByText('Shipped: waiting for tracking updates')).toBeDefined();
  });

  it('in-flight courier collection: ETA copy renders as a 3rd subtitle line', () => {
    const inFlightOrder = {
      ...baseOrder,
      status: 'shipped' as const,
      delivered_at: null,
    };
    render(
      <UnifiedTimeline
        order={inFlightOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL_OUT', '2026-04-17T08:58:56Z', 'Häädemeeste'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.getByText('Collected by courier')).toBeDefined();
    expect(screen.getByText('Typically 2–3 working days')).toBeDefined();
  });

  it('post-arrival: ETA copy is gone once RECEIVED_TERMINAL has fired', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL_OUT', '2026-04-17T08:58:56Z', 'Häädemeeste'),
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL', '2026-04-18T03:05:55Z', 'Rīga'),
        ]}
        trackingUrl={null}
      />
    );

    expect(screen.queryByText('Typically 2–3 working days')).toBeNull();
    expect(screen.queryByText('Typically next working day')).toBeNull();
  });

  it('icon dots: all rendered at uniform 20px square (rounded-md)', () => {
    const completedOrder = {
      ...baseOrder,
      status: 'completed' as const,
      completed_at: '2026-04-20T15:00:00Z',
    };
    const { container } = render(
      <UnifiedTimeline
        order={completedOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL_OUT', '2026-04-17T08:58:56Z', 'Häädemeeste'),
          trackingEvent('PARCEL_DELIVERED', 'DELIVERY_DELIVERED', '2026-04-18T08:56:25Z', 'Rīga'),
        ]}
        trackingUrl={null}
      />
    );

    // All rows render a dot of the unified size and shape; no rounded-full pills or w-4 dots remain
    expect(
      container.querySelectorAll<HTMLDivElement>('.w-5.h-5.rounded-md').length
    ).toBeGreaterThan(0);
    expect(container.querySelector('.rounded-full')).toBeNull();
    expect(container.querySelector('.w-4.h-4')).toBeNull();
  });

  it('past tracking event reads as outlined (white bg + brand border) to differentiate from solid milestones', () => {
    // Tracking event needs to be a *past* (not isCurrent) entry to receive the outlined style;
    // setting status to 'completed' with a later milestone pushes the tracking row into the past.
    const completedOrder = {
      ...baseOrder,
      status: 'completed' as const,
      completed_at: '2026-04-20T15:00:00Z',
    };
    const { container } = render(
      <UnifiedTimeline
        order={completedOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL_OUT', '2026-04-17T08:58:56Z', 'Häädemeeste'),
          trackingEvent('PARCEL_DELIVERED', 'DELIVERY_DELIVERED', '2026-04-18T08:56:25Z', 'Rīga'),
        ]}
        trackingUrl={null}
      />
    );

    expect(
      container.querySelector('.bg-semantic-bg-elevated.border-2.border-semantic-brand')
    ).not.toBeNull();
  });
});
