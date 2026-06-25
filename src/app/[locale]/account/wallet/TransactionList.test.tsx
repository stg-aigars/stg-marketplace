// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TransactionList } from './TransactionList';
import type { WalletTransactionRow } from '@/lib/wallet/types';

function transaction(overrides: Partial<WalletTransactionRow>): WalletTransactionRow {
  return {
    id: 'txn-1',
    wallet_id: 'wallet-1',
    user_id: 'user-1',
    type: 'credit',
    amount_cents: 1000,
    balance_after_cents: 5000,
    order_id: null,
    withdrawal_id: null,
    description: 'Test transaction',
    created_at: '2026-06-24T00:00:00Z',
    ...overrides,
  };
}

describe('TransactionList — refund type rendering', () => {
  afterEach(cleanup);

  it('renders a refund transaction with the Refund label, success badge, and a + sign', () => {
    render(
      <TransactionList
        initialTransactions={[transaction({ type: 'refund', amount_cents: 1500 })]}
        initialTotal={1}
      />
    );

    const badge = screen.getByText('Refund');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('condition-like-new'); // success variant token
    expect(screen.getByText('+15,00 €')).toBeDefined();
  });

  it('renders a credit transaction the same way, for contrast', () => {
    render(
      <TransactionList
        initialTransactions={[transaction({ type: 'credit', amount_cents: 1500 })]}
        initialTotal={1}
      />
    );

    expect(screen.getByText('Credit')).toBeDefined();
    expect(screen.getByText('+15,00 €')).toBeDefined();
  });

  it('renders a debit transaction with a - sign, for contrast', () => {
    render(
      <TransactionList
        initialTransactions={[transaction({ type: 'debit', amount_cents: 1500 })]}
        initialTotal={1}
      />
    );

    expect(screen.getByText('Payment')).toBeDefined();
    expect(screen.getByText('-15,00 €')).toBeDefined();
  });
});
