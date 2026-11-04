import { describe, it, expect } from 'vitest';
import { selectReplyRecipients } from './recipients';

describe('selectReplyRecipients', () => {
  it('includes every previous commenter on the first seller reply', () => {
    const result = selectReplyRecipients(
      [
        { user_id: 'alice', created_at: '2026-11-01T10:00:00.000Z' },
        { user_id: 'bob', created_at: '2026-11-01T11:00:00.000Z' },
      ],
      [],
    );
    expect(result.sort()).toEqual(['alice', 'bob']);
  });

  it('skips commenters already notified since their last comment', () => {
    const result = selectReplyRecipients(
      [{ user_id: 'alice', created_at: '2026-11-01T10:00:00.000Z' }],
      [{ user_id: 'alice', created_at: '2026-11-01T12:00:00.000Z' }],
    );
    expect(result).toEqual([]);
  });

  it('re-includes a commenter who posted again after being notified', () => {
    const result = selectReplyRecipients(
      [
        { user_id: 'alice', created_at: '2026-11-01T10:00:00.000Z' },
        { user_id: 'alice', created_at: '2026-11-02T09:00:00.000Z' },
      ],
      [{ user_id: 'alice', created_at: '2026-11-01T12:00:00.000Z' }],
    );
    expect(result).toEqual(['alice']);
  });

  it('returns each commenter once regardless of comment count', () => {
    const result = selectReplyRecipients(
      [
        { user_id: 'alice', created_at: '2026-11-01T10:00:00.000Z' },
        { user_id: 'alice', created_at: '2026-11-01T10:05:00.000Z' },
        { user_id: 'alice', created_at: '2026-11-01T10:10:00.000Z' },
      ],
      [],
    );
    expect(result).toEqual(['alice']);
  });

  it('uses the latest timestamps regardless of input order', () => {
    const result = selectReplyRecipients(
      [
        { user_id: 'alice', created_at: '2026-11-02T09:00:00.000Z' },
        { user_id: 'alice', created_at: '2026-11-01T10:00:00.000Z' },
      ],
      [
        { user_id: 'alice', created_at: '2026-11-01T12:00:00.000Z' },
        { user_id: 'alice', created_at: '2026-11-03T08:00:00.000Z' },
      ],
    );
    expect(result).toEqual([]);
  });

  it('ignores rows from anonymized (deleted) users', () => {
    const result = selectReplyRecipients(
      [{ user_id: null, created_at: '2026-11-01T10:00:00.000Z' }],
      [],
    );
    expect(result).toEqual([]);
  });
});
