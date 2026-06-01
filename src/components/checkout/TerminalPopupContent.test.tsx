// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TerminalPopupContent } from './TerminalPopupContent';
import type { TerminalOption } from '@/lib/services/unisend/types';

const terminal: TerminalOption = {
  id: 'LV101',
  name: 'Rimi Centrs',
  city: 'Riga',
  address: 'Brivibas iela 1',
  postalCode: 'LV-1010',
  countryCode: 'LV',
  latitude: '56.9496',
  longitude: '24.1052',
};

afterEach(cleanup);

describe('TerminalPopupContent', () => {
  it('renders the Select terminal button by default (checkout behavior)', () => {
    render(<TerminalPopupContent terminal={terminal} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Select terminal' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Get directions' })).toBeNull();
  });

  it('calls onSelect when the Select button is clicked', () => {
    const onSelect = vi.fn();
    render(<TerminalPopupContent terminal={terminal} onSelect={onSelect} />);
    screen.getByRole('button', { name: 'Select terminal' }).click();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('renders a Get directions link in directions mode with a maps URL and safe rel', () => {
    render(<TerminalPopupContent terminal={terminal} action="directions" onSelect={() => {}} />);
    const link = screen.getByRole('link', { name: 'Get directions' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=56.9496,24.1052'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('button', { name: 'Select terminal' })).toBeNull();
  });
});
