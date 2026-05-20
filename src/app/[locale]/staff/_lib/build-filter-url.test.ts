import { describe, it, expect } from 'vitest';
import { buildStaffFilterUrl } from './build-filter-url';

describe('buildStaffFilterUrl', () => {
  it('returns bare path when all values match defaults', () => {
    const url = buildStaffFilterUrl(
      '/staff/notices',
      { filter: 'open', binding: 'any' },
      {},
      { filter: 'open', binding: 'any' },
    );
    expect(url).toBe('/staff/notices');
  });

  it('returns bare path when current values are empty/undefined', () => {
    const url = buildStaffFilterUrl(
      '/staff/audit',
      { action: undefined, resource_type: '' },
      {},
    );
    expect(url).toBe('/staff/audit');
  });

  it('emits only non-default keys', () => {
    const url = buildStaffFilterUrl(
      '/staff/notices',
      { filter: 'open', binding: 'any' },
      { filter: 'reviewing' },
      { filter: 'open', binding: 'any' },
    );
    expect(url).toBe('/staff/notices?filter=reviewing');
  });

  it('drops a key that next-overrides back to default', () => {
    const url = buildStaffFilterUrl(
      '/staff/notices',
      { filter: 'reviewing', binding: 'bound' },
      { filter: 'open' },
      { filter: 'open', binding: 'any' },
    );
    expect(url).toBe('/staff/notices?binding=bound');
  });

  it('preserves multiple non-default keys in stable insertion order', () => {
    const url = buildStaffFilterUrl(
      '/staff/feedback',
      { status: 'new', category: 'all' },
      { status: 'triaged', category: 'bug' },
      { status: 'new', category: 'all' },
    );
    expect(url).toBe('/staff/feedback?status=triaged&category=bug');
  });

  it('omits defaults={} entirely and emits every truthy key', () => {
    const url = buildStaffFilterUrl(
      '/staff/audit',
      { actor_type: 'cron', action: 'order.refunded' },
      {},
    );
    expect(url).toBe('/staff/audit?actor_type=cron&action=order.refunded');
  });

  it('passes through pre-encoded values without double-encoding', () => {
    const url = buildStaffFilterUrl(
      '/staff/audit',
      { action: 'order.status_changed' },
      {},
    );
    expect(url).toBe('/staff/audit?action=order.status_changed');
  });
});
