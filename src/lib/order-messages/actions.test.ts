import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockCreateClient = vi.fn();
const mockCreateServiceClient = vi.fn();
const mockNotify = vi.fn();
const mockSendOrderMessageReceivedToRecipient = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock('@/lib/supabase', () => ({
  createServiceClient: (...args: unknown[]) => mockCreateServiceClient(...args),
}));
vi.mock('@/lib/notifications', () => ({
  notify: (...args: unknown[]) => {
    mockNotify(...args);
    return Promise.resolve();
  },
}));
vi.mock('@/lib/email', () => ({
  sendOrderMessageReceivedToRecipient: (...args: unknown[]) =>
    mockSendOrderMessageReceivedToRecipient(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserSupabaseMock(opts: {
  order: { id: string; buyer_id: string; seller_id: string; order_number: string } | null;
  senderProfile: { full_name: string | null } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === 'orders') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: opts.order, error: null }),
          }),
        }),
      };
    }
    if (table === 'public_profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: opts.senderProfile, error: null }),
          }),
        }),
      };
    }
    if (table === 'order_messages') {
      return { insert: () => Promise.resolve({ error: null }) };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'sender-uuid' } } }) },
    from,
  };
}

function makeServiceSupabaseMock(recipientProfile: { full_name: string | null; email: string | null } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: recipientProfile, error: null }),
        }),
      }),
    }),
  };
}

// Flush the fire-and-forget async IIFE inside postOrderMessage before assertions.
async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('postOrderMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies and emails the seller when the buyer messages', async () => {
    mockCreateClient.mockResolvedValue(
      makeUserSupabaseMock({
        order: { id: 'order-1', buyer_id: 'sender-uuid', seller_id: 'seller-uuid', order_number: 'STG-1' },
        senderProfile: { full_name: 'Buyer Name' },
      }),
    );
    mockCreateServiceClient.mockReturnValue(
      makeServiceSupabaseMock({ full_name: 'Seller Name', email: 'seller@example.com' }),
    );

    const { postOrderMessage } = await import('./actions');
    const result = await postOrderMessage('order-1', 'Hello there');
    await flushMicrotasks();

    expect(result).toEqual({ success: true });
    expect(mockNotify).toHaveBeenCalledWith('seller-uuid', 'order.message_received', {
      senderName: 'Buyer Name',
      orderNumber: 'STG-1',
      orderId: 'order-1',
    });
    expect(mockSendOrderMessageReceivedToRecipient).toHaveBeenCalledWith({
      recipientName: 'Seller Name',
      recipientEmail: 'seller@example.com',
      senderName: 'Buyer Name',
      orderNumber: 'STG-1',
      orderId: 'order-1',
      messageBody: 'Hello there',
    });
  });

  it('skips the email but still notifies when the recipient has no email on file', async () => {
    mockCreateClient.mockResolvedValue(
      makeUserSupabaseMock({
        order: { id: 'order-1', buyer_id: 'sender-uuid', seller_id: 'seller-uuid', order_number: 'STG-1' },
        senderProfile: { full_name: 'Buyer Name' },
      }),
    );
    mockCreateServiceClient.mockReturnValue(makeServiceSupabaseMock(null));

    const { postOrderMessage } = await import('./actions');
    const result = await postOrderMessage('order-1', 'Hello there');
    await flushMicrotasks();

    expect(result).toEqual({ success: true });
    expect(mockNotify).toHaveBeenCalled();
    expect(mockSendOrderMessageReceivedToRecipient).not.toHaveBeenCalled();
  });

  it('returns an error without side effects when the order is not found', async () => {
    mockCreateClient.mockResolvedValue(
      makeUserSupabaseMock({ order: null, senderProfile: { full_name: 'Buyer Name' } }),
    );

    const { postOrderMessage } = await import('./actions');
    const result = await postOrderMessage('order-1', 'Hello there');

    expect(result).toEqual({ error: 'Order not found' });
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockSendOrderMessageReceivedToRecipient).not.toHaveBeenCalled();
  });
});
