import { createServiceClient } from '@/lib/supabase';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from './index';
import { notify } from '@/lib/notifications';
import { orderGameSummary } from '@/lib/orders/utils';
import { TERMS_VERSION, SELLER_TERMS_VERSION } from '@/lib/legal/constants';

interface CartOrderEmailData {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  items: Array<{ gameName: string; priceCents: number }>;
  shippingCents: number;
  terminalName: string;
}

/**
 * Send order emails for all orders in a cart group.
 * Each order may contain multiple items (same seller).
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
      .select('id, full_name, email, country')
      .in('id', userIds);

    if (!profiles) return;

    const profileMap = new Map(
      profiles.map((p: { id: string; full_name: string | null; email: string | null; country: string | null }) => [p.id, p])
    );
    const buyerProfile = profileMap.get(buyerId);

    for (const order of orders) {
      const sellerProfile = profileMap.get(order.sellerId);
      const gameName = orderGameSummary(order.items);
      const totalItemsCents = order.items.reduce((sum, i) => sum + i.priceCents, 0);

      const emailData = {
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        gameName,
        priceCents: totalItemsCents,
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
          // Phase 8: durable-medium delivery (PTAC §5.1, ECJ C-49/11)
          buyerCountry: buyerProfile.country ?? null,
          termsVersion: TERMS_VERSION,
          sellerTermsVersion: SELLER_TERMS_VERSION,
        }).catch((err) => console.error('[Email] Cart order buyer confirmation failed:', err));
      }

      // In-app notifications
      void notify(order.sellerId, 'order.created', {
        gameName,
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        buyerName: buyerProfile?.full_name ?? 'Buyer',
        role: 'seller',
      });
      void notify(buyerId, 'order.created', {
        gameName,
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        sellerName: sellerProfile?.full_name ?? 'Seller',
        role: 'buyer',
      });
    }
  } catch (err) {
    console.error('[Email] Cart order emails failed:', err);
  }
}
