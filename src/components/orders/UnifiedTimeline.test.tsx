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

describe('UnifiedTimeline event_type label overrides', () => {
  afterEach(cleanup);

  it('renders RECEIVED_TERMINAL_OUT as "Collected by courier"', () => {
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
    // Generic state-type label does not appear for this row
    expect(screen.queryByText('In transit')).toBeNull();
  });

  it('renders RECEIVED_TERMINAL with destinationTerminal as "Ready for pickup at <terminal>" and keeps the event location line', () => {
    render(
      <UnifiedTimeline
        order={baseOrder}
        trackingEvents={[
          trackingEvent('ON_THE_WAY', 'RECEIVED_TERMINAL', '2026-04-18T03:05:55Z', 'Rīga'),
        ]}
        trackingUrl={null}
        destinationTerminal="Rīga LSE Park"
      />
    );

    // Label uses the order's destination terminal name (not the event location)
    expect(screen.getByText('Ready for pickup at Rīga LSE Park')).toBeDefined();
    // The event's own location ("Rīga", the city Unisend scanned at) still renders below the label
    expect(screen.getByText('Rīga')).toBeDefined();
  });

  it('regression: NOTIFICATIONS_INFORMED with no destinationTerminal falls back to "Ready for pickup"', () => {
    // The no-prop branch has shipped since commit 32bc5a9 for NOTIFICATIONS_INFORMED. This test
    // guards that behaviour through the migration into EVENT_TYPE_OVERRIDES — do not delete as
    // redundant with the override-map test above.
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
});
