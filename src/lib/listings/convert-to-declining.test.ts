import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockCreateClient = vi.fn();
const mockCreateServiceClient = vi.fn();
const mockLogAuditEvent = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock('@/lib/supabase', () => ({
  createServiceClient: (...args: unknown[]) => mockCreateServiceClient(...args),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));
vi.mock('@/lib/email', () => ({
  sendWantedListingMatchedToBuyer: vi.fn(),
  sendListingPriceDroppedToBuyer: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SELLER_ID = 'seller-uuid';

function makeAuthedClient(listingRow: Record<string, unknown> | null, fetchError: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: listingRow, error: fetchError });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: SELLER_ID } } }) },
    from,
  };
}

function makeServiceClient(updateError: unknown = null) {
  const eq3 = vi.fn().mockResolvedValue({ error: updateError });
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ update });
  return { from };
}

const baseListing = {
  seller_id: SELLER_ID,
  status: 'active',
  listing_type: 'fixed_price',
  price_cents: 2000,
};

const validSchedule = { floor_price_cents: 500, decrement_cents: 100, drop_interval_days: 7 };

describe('convertListingToDeclining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when no user is signed in', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', validSchedule);

    expect(result).toEqual({ error: 'You must be signed in' });
  });

  it('rejects when the listing does not belong to the caller', async () => {
    mockCreateClient.mockResolvedValue(makeAuthedClient({ ...baseListing, seller_id: 'someone-else' }));

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', validSchedule);

    expect(result).toEqual({ error: 'Listing not found' });
  });

  it('rejects when the listing is not active', async () => {
    mockCreateClient.mockResolvedValue(makeAuthedClient({ ...baseListing, status: 'reserved' }));

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', validSchedule);

    expect(result).toEqual({ error: 'Only active listings can be switched to declining price' });
  });

  it('rejects when the listing is not fixed-price', async () => {
    mockCreateClient.mockResolvedValue(makeAuthedClient({ ...baseListing, listing_type: 'auction' }));

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', validSchedule);

    expect(result).toEqual({ error: 'Only fixed-price listings can be switched to declining price' });
  });

  it('rejects an invalid schedule (floor at or above current price)', async () => {
    mockCreateClient.mockResolvedValue(makeAuthedClient(baseListing));

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', {
      floor_price_cents: 2000,
      decrement_cents: 100,
      drop_interval_days: 7,
    });

    expect(result).toEqual({ error: 'Floor price must be lower than the starting price' });
  });

  it('converts a valid fixed-price listing and writes the schedule fields', async () => {
    mockCreateClient.mockResolvedValue(makeAuthedClient(baseListing));
    const service = makeServiceClient();
    mockCreateServiceClient.mockReturnValue(service);

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', validSchedule);

    expect(result).toEqual({ success: true });
    expect(service.from).toHaveBeenCalledWith('listings');

    const updateCall = service.from.mock.results[0].value.update.mock.calls[0][0];
    expect(updateCall).toMatchObject({
      listing_type: 'declining',
      starting_price_cents: 2000,
      floor_price_cents: 500,
      decrement_cents: 100,
      drop_interval_days: 7,
    });
    expect(updateCall.schedule_start_at).toBeTypeOf('string');
    expect(updateCall.next_drop_at).toBeTypeOf('string');

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      service,
      expect.objectContaining({ action: 'listing.converted_to_declining', resourceId: 'listing-1' }),
    );
  });

  it('surfaces a generic error when the update fails', async () => {
    mockCreateClient.mockResolvedValue(makeAuthedClient(baseListing));
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ message: 'db down' }));

    const { convertListingToDeclining } = await import('./actions');
    const result = await convertListingToDeclining('listing-1', validSchedule);

    expect(result).toEqual({ error: 'Something went wrong. Please try again' });
  });
});
