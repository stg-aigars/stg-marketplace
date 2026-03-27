import { createServiceClient } from '@/lib/supabase';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from './index';

interface CartOrderEmailData {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  gameName: string;
  priceCents: number;
  shippingCents: number;
  terminalName: string;
}

/**
 * Send order emails for all orders in a cart group.
 * Batch-fetches profiles and sends emails for each order.
 * Non-blocking — intended to be called with `void`.
 */
export async function sendCartOrderEmails(
  orders: CartOrderEmailData[],
  buyerId: string
): Promise<void> {
  try {
    const serviceClient = createServiceClient();

    const userIds = Array.from(
      new Set([buyerId, ...orders.map((o) => o.sellerId)])
    );
    const { data: profiles } = await serviceClient
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (!profiles) return;

    const profileMap = new Map(
      profiles.map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p])
    );
    const buyerProfile = profileMap.get(buyerId);

    for (const order of orders) {
      const sellerProfile = profileMap.get(order.sellerId);

      const emailData = {
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        gameName: order.gameName,
        priceCents: order.priceCents,
        shippingCents: order.shippingCents,
        terminalName: order.terminalName,
      };

      if (sellerProfile?.email) {
        sendNewOrderToSeller({
          ...emailData,
          sellerName: sellerProfile.full_name ?? 'Seller',
          sellerEmail: sellerProfile.email,
          buyerName: buyerProfile?.full_name ?? 'Buyer',
        }).catch((err) => console.error('[Email] Cart order seller notification failed:', err));
      }

      if (buyerProfile?.email) {
        sendOrderConfirmationToBuyer({
          ...emailData,
          buyerName: buyerProfile.full_name ?? 'Buyer',
          buyerEmail: buyerProfile.email,
          sellerName: sellerProfile?.full_name ?? 'Seller',
        }).catch((err) => console.error('[Email] Cart order buyer confirmation failed:', err));
      }
    }
  } catch (err) {
    console.error('[Email] Cart order emails failed:', err);
  }
}
