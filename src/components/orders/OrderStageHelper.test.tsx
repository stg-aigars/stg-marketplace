// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OrderStageHelper } from './OrderStageHelper';

afterEach(cleanup);

const baseProps = { sellerCountry: 'LV' as const, terminals: [] };

describe('OrderStageHelper', () => {
  it('renders the Accepted helper for a seller on an accepted order', () => {
    render(<OrderStageHelper role="seller" status="accepted" {...baseProps} />);
    expect(screen.getByText('Ship your parcel')).toBeDefined();
    const link = screen.getByRole('link', { name: /Read the packing guide/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/help/packing');
    expect(screen.getByRole('button', { name: /Find a drop-off locker/i })).toBeDefined();
  });

  it('keeps the locker finder collapsed until the button is clicked', () => {
    render(<OrderStageHelper role="seller" status="accepted" {...baseProps} />);
    // Collapsed: no finder content yet (empty terminals would show unavailable text).
    expect(screen.queryByText(/Locker map is unavailable right now/i)).toBeNull();
    // fireEvent (not native .click()) so React 19 flushes the state update
    // synchronously inside act — a raw .click() does not flush in this harness.
    fireEvent.click(screen.getByRole('button', { name: /Find a drop-off locker/i }));
    expect(screen.getByText(/Locker map is unavailable right now/i)).toBeDefined();
  });

  it('renders nothing for non-accepted statuses', () => {
    const { container } = render(<OrderStageHelper role="seller" status="shipped" {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for the buyer role', () => {
    const { container } = render(<OrderStageHelper role="buyer" status="accepted" {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });
});
