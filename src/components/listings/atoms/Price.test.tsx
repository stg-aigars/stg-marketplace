// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Price } from './Price';

afterEach(() => cleanup());

describe('Price', () => {
  it('renders the current price formatted as currency', () => {
    const { container } = render(<Price cents={3550} />);
    expect(container.textContent).toContain('35,50 €');
  });

  it('renders no strikethrough element when previousCents is undefined', () => {
    const { container } = render(<Price cents={3000} />);
    expect(container.querySelector('s')).toBeNull();
    expect(container.querySelector('[aria-label]')).toBeNull();
  });

  it('renders a struck-through old price when previousCents is set', () => {
    const { container } = render(<Price cents={3000} previousCents={4000} />);
    const struck = container.querySelector('s');
    expect(struck).not.toBeNull();
    expect(struck?.textContent).toContain('40,00 €');
    expect(container.textContent).toContain('30,00 €');
  });

  it('marks the struck price aria-hidden so screen readers do not double-read', () => {
    const { container } = render(<Price cents={3000} previousCents={4000} />);
    expect(container.querySelector('s')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('puts an aria-label on the wrapper describing the drop', () => {
    const { container } = render(<Price cents={3000} previousCents={4000} />);
    const wrapper = container.querySelector('[aria-label]');
    expect(wrapper?.getAttribute('aria-label')).toBe('Price dropped from 40,00 € to 30,00 €');
  });

  it('supports an xl size for detail-page headings', () => {
    const { container } = render(<Price cents={3000} size="xl" />);
    expect(container.firstElementChild?.className).toContain('text-3xl');
  });
});
