import { createServiceClient } from '@/lib/supabase';
import { sendNewOrderToSeller, sendOrderConfirmationToBuyer } from './index';
import { sendAdminNotification } from './admin-notifications';
import { notify } from '@/lib/notifications';
import { orderGameSummary } from '@/lib/orders/utils';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { TERMS_VERSION, SELLER_TERMS_VERSION } from '@/lib/legal/constants';
import type { TerminalEmailFields } from '@/lib/terminals/format';

interface CartOrderEmailData extends TerminalEmailFields {
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

      const baseEmailData = {
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        gameName,
        priceCents: totalItemsCents,
        shippingCents: order.shippingCents,
        terminalName: order.terminalName,
      };

      if (sellerProfile?.email) {
        sendNewOrderToSeller({
          ...baseEmailData,
          terminalCity: order.terminalCity,
          terminalCountry: order.terminalCountry,
          sellerName: sellerProfile.full_name ?? 'Seller',
          sellerEmail: sellerProfile.email,
          buyerName: buyerProfile?.full_name ?? 'Buyer',
        }).catch((err) => console.error('[Email] Cart order seller notification failed:', err));
      }

      if (buyerProfile?.email) {
        sendOrderConfirmationToBuyer({
          ...baseEmailData,
          terminalAddress: order.terminalAddress,
          terminalCity: order.terminalCity,
          terminalPostalCode: order.terminalPostalCode,
          terminalCountry: order.terminalCountry,
          buyerName: buyerProfile.full_name ?? 'Buyer',
          buyerEmail: buyerProfile.email,
          sellerName: sellerProfile?.full_name ?? 'Seller',
          // Phase 8: durable-medium delivery (PTAC §5.1, ECJ C-49/11)
          buyerCountry: buyerProfile.country ?? null,
          termsVersion: TERMS_VERSION,
          sellerTermsVersion: SELLER_TERMS_VERSION,
        }).catch((err) => console.error('[Email] Cart order buyer confirmation failed:', err));
      }

      // Internal admin alert (same channel as the new-signup email)
      void sendAdminNotification(`New order: ${order.orderNumber}`, [
        `A new order was created on Second Turn Games.`,
        ``,
        `Order:    ${order.orderNumber}`,
        `Items:    ${gameName}`,
        `Total:    ${formatCentsToCurrency(totalItemsCents + order.shippingCents)} (incl. shipping)`,
        `Buyer:    ${buyerProfile?.full_name ?? '(unknown)'} (${buyerId})`,
        `Seller:   ${sellerProfile?.full_name ?? '(unknown)'} (${order.sellerId})`,
        `Order ID: ${order.orderId}`,
      ]);

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
