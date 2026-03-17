/**
 * Shipping orchestration for T2T (Terminal-to-Terminal) orders.
 * Handles parcel creation, order updates, and seller notification.
 *
 * Replaces the old label-service.ts + prepare-and-generate-label.ts
 * with T2T-correct terminology and cleaner separation from order transitions.
 */

import { createAndShipParcel } from './client';
import { UnisendValidationError, UNISEND_DEFAULT_PARCEL_SIZE, PHONE_FORMATS } from './types';
import type { ParcelSize, TerminalCountry } from './types';
import { formatLabelError } from './format-label-error';
import { createServiceClient } from '@/lib/supabase';
import {
  detectPhoneCountry,
  composePhoneNumber,
  isValidPhoneNumber,
  getPhonePrefix,
  type PhoneCountryCode,
} from '@/lib/phone-utils';
import { sendShippingLabelToSeller } from '@/lib/email';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShippingContext {
  orderId: string;
  orderNumber: string;
  seller: { fullName: string; phone: string; email: string; country: string | null };
  buyer: { fullName: string; email: string };
  receiver: { name: string; phone: string };
  destination: {
    country: string | null;
    terminalId: string;
    terminalName: string;
    terminalAddress: string;
  };
  parcelSize: string | null;
}

export type ShippingResult =
  | { success: true; parcelId: number; barcode: string; trackingUrl: string | undefined }
  | { success: false; error: string };

const BALTIC_COUNTRIES = ['LV', 'LT', 'EE'];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Construct the public tracking URL for a given barcode.
 */
export function getTrackingUrl(barcode: string | undefined): string | undefined {
  if (!barcode || barcode.trim() === '') {
    return undefined;
  }
  return `https://www.post.lt/siuntu-sekimas/?parcels=${encodeURIComponent(barcode)}`;
}

/**
 * Write a shipping error to the order record.
 * Uses service client to bypass RLS.
 */
export async function updateOrderShippingError(
  orderId: string,
  error: string
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('orders')
    .update({ shipping_error: error })
    .eq('id', orderId);
}

/**
 * Create shipping for an accepted order.
 * Called by acceptOrder() after the order has been transitioned to 'accepted'.
 *
 * On success: stores parcelId/barcode/trackingUrl on the order, sends email.
 * On failure: stores shipping_error on the order for later retry.
 */
export async function createOrderShipping(ctx: ShippingContext): Promise<ShippingResult> {
  const { orderId, orderNumber, seller, buyer, receiver, destination, parcelSize } = ctx;
  const logPrefix = `[Shipping ${orderId}]`;

  // 1. Normalize phones
  const sellerPhoneParsed = detectPhoneCountry(seller.phone);
  const normalizedSellerPhone = composePhoneNumber(sellerPhoneParsed.country, sellerPhoneParsed.localNumber);
  const receiverPhoneParsed = detectPhoneCountry(receiver.phone);
  const normalizedReceiverPhone = composePhoneNumber(receiverPhoneParsed.country, receiverPhoneParsed.localNumber);

  // 2. Validate receiver phone against destination country mobile format
  const destCountry = destination.country as TerminalCountry;
  const destFormat = PHONE_FORMATS[destCountry];

  const prefixOnly = getPhonePrefix(receiverPhoneParsed.country as PhoneCountryCode);
  const receiverPhoneEmpty = !normalizedReceiverPhone || normalizedReceiverPhone === prefixOnly;

  if (receiverPhoneEmpty) {
    const example = destFormat?.example ?? '+3706XXXXXXX';
    const errorMsg = `Buyer phone number is missing. For ${destCountry} deliveries, a ${destCountry} mobile number is required (e.g. ${example}).`;
    console.error(`${logPrefix} ${errorMsg}`);
    await updateOrderShippingError(orderId, errorMsg);
    return { success: false, error: errorMsg };
  }

  if (destFormat && !destFormat.regex.test(normalizedReceiverPhone)) {
    const errorMsg = `Buyer phone must be a valid ${destCountry} mobile number (e.g. ${destFormat.example}). Current number: ${normalizedReceiverPhone}`;
    console.error(`${logPrefix} ${errorMsg}`);
    await updateOrderShippingError(orderId, errorMsg);
    return { success: false, error: errorMsg };
  }

  // 3. Validate seller phone
  if (normalizedSellerPhone && !isValidPhoneNumber(normalizedSellerPhone)) {
    console.error(`${logPrefix} Invalid seller phone: ${seller.phone} -> ${normalizedSellerPhone}`);
    const errorMsg = 'Invalid seller phone number. Please update your phone in Account Settings.';
    await updateOrderShippingError(orderId, errorMsg);
    return { success: false, error: errorMsg };
  }

  // 4. Validate countries
  if (!seller.country || !BALTIC_COUNTRIES.includes(seller.country)) {
    const errorMsg = 'Seller country not set. Please update your country in Account Settings.';
    await updateOrderShippingError(orderId, errorMsg);
    return { success: false, error: errorMsg };
  }

  if (!destination.country || !BALTIC_COUNTRIES.includes(destination.country)) {
    const errorMsg = 'Destination country missing on order.';
    await updateOrderShippingError(orderId, errorMsg);
    return { success: false, error: errorMsg };
  }

  // 5. Create parcel and initiate shipping
  console.log(`${logPrefix} Creating parcel...`);
  console.log(`${logPrefix} Sender: ${seller.fullName}, Phone: ${seller.phone} -> ${normalizedSellerPhone}, Country: ${seller.country}`);
  console.log(`${logPrefix} Receiver: ${receiver.name}, Phone: ${receiver.phone} -> ${normalizedReceiverPhone}, Country: ${destination.country}`);
  console.log(`${logPrefix} Terminal: ${destination.terminalId || '(empty)'}, Parcel Size: ${parcelSize || UNISEND_DEFAULT_PARCEL_SIZE}`);

  try {
    const { parcelId, barcode, trackingUrl: rawTrackingUrl } = await createAndShipParcel({
      plan: { code: 'TERMINAL' },
      parcel: {
        type: 'T2T',
        size: (parcelSize as ParcelSize) || UNISEND_DEFAULT_PARCEL_SIZE,
        weight: 2,
      },
      sender: {
        name: seller.fullName,
        address: { countryCode: seller.country as TerminalCountry },
        contacts: { phone: normalizedSellerPhone },
      },
      receiver: {
        name: receiver.name,
        address: {
          countryCode: destCountry,
          terminalId: destination.terminalId,
        },
        contacts: { phone: normalizedReceiverPhone },
      },
    });

    const trackingUrl = rawTrackingUrl || getTrackingUrl(barcode);
    console.log(`${logPrefix} Parcel created: parcelId=${parcelId}, barcode=${barcode}`);

    // 6. Update order with shipping data
    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        unisend_parcel_id: parcelId,
        barcode,
        tracking_url: trackingUrl,
        shipping_error: null,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error(`${logPrefix} Failed to save shipping data:`, updateError);
      return { success: false, error: `Parcel created but failed to save: ${updateError.message}` };
    }

    // 7. Send shipping instructions email to seller (non-blocking)
    sendShippingLabelToSeller({
      sellerName: seller.fullName,
      sellerEmail: seller.email,
      orderNumber,
      orderId,
      buyerName: buyer.fullName,
      destinationTerminalName: destination.terminalName,
      destinationTerminalAddress: destination.terminalAddress,
      parcelId: String(parcelId),
      barcode,
      trackingUrl,
    }).catch((err) => {
      console.error(`${logPrefix} Failed to send shipping email:`, err);
    });

    return { success: true, parcelId, barcode, trackingUrl };
  } catch (error) {
    console.error(`${logPrefix} Parcel creation failed:`, error);

    const errorMessage = formatLabelError(error);
    if (error instanceof UnisendValidationError) {
      console.error(`${logPrefix} Validation errors:`, error.validationErrors);
    }

    await updateOrderShippingError(orderId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Retry shipping for an order where the initial Unisend call failed.
 * Only the seller can retry, and only when shipping previously failed.
 */
export async function retryOrderShipping(
  orderId: string,
  userId: string
): Promise<ShippingResult> {
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      listings(game_name, seller_id),
      buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email, phone, country),
      seller_profile:user_profiles!orders_seller_id_fkey(full_name, email, phone, country)
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.seller_id !== userId) {
    return { success: false, error: 'Only the seller can retry shipping' };
  }

  if (order.status !== 'accepted') {
    return { success: false, error: `Cannot retry shipping for order in ${order.status} status` };
  }

  if (!order.shipping_error) {
    return { success: false, error: 'No shipping error to retry — shipping may have already succeeded' };
  }

  if (order.unisend_parcel_id) {
    return { success: false, error: 'Parcel already created — cannot create a duplicate' };
  }

  return createOrderShipping({
    orderId,
    orderNumber: order.order_number,
    seller: {
      fullName: order.seller_profile?.full_name ?? 'Seller',
      phone: order.seller_phone ?? order.seller_profile?.phone ?? '',
      email: order.seller_profile?.email ?? '',
      country: order.seller_profile?.country ?? order.seller_country,
    },
    buyer: {
      fullName: order.buyer_profile?.full_name ?? 'Buyer',
      email: order.buyer_profile?.email ?? '',
    },
    receiver: {
      name: order.buyer_profile?.full_name ?? 'Buyer',
      phone: order.buyer_phone ?? '',
    },
    destination: {
      country: order.terminal_country,
      terminalId: order.terminal_id ?? '',
      terminalName: order.terminal_name ?? '',
      terminalAddress: '',
    },
    parcelSize: null,
  });
}
