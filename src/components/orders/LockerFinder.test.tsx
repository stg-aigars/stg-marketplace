// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LockerFinder } from './LockerFinder';

afterEach(cleanup);

describe('LockerFinder', () => {
  it('shows an unavailable message and no search box when there are no terminals', () => {
    render(<LockerFinder terminals={[]} country="LV" />);
    expect(screen.getByText(/locker map isn't loading right now/i)).toBeDefined();
    expect(screen.queryByPlaceholderText('Search lockers...')).toBeNull();
  });
});
