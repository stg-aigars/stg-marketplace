import { generateShippingLabel, updateOrderWithShippingData, updateOrderLabelError } from './label-service';
import { UnisendValidationError, UNISEND_DEFAULT_PARCEL_SIZE, PHONE_FORMATS, type ParcelSize, type TerminalCountry } from './types';
import { formatLabelError } from './format-label-error';
import { detectPhoneCountry, composePhoneNumber, isValidPhoneNumber, getPhonePrefix, type PhoneCountryCode } from '@/lib/phone-utils';
import { sendShippingLabelToSeller } from '@/lib/email/send-order-emails';

export interface LabelGenerationContext {
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

export interface LabelGenerationResult {
  labelGenerated: boolean;
  labelError?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  parcelId?: number;
  barcode?: string;
  labelUrl?: string;
}

const BALTIC_COUNTRIES = ['LV', 'LT', 'EE'];

/**
 * Shared label generation logic used by both accept and retry-label routes.
 * Handles phone normalization, country validation, label generation,
 * order update, and seller email notification.
 */
export async function prepareAndGenerateLabel(
  ctx: LabelGenerationContext
): Promise<LabelGenerationResult> {
  const { orderId, orderNumber, seller, buyer, receiver, destination, parcelSize } = ctx;
  const logPrefix = `[Label ${orderId}]`;

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
    await updateOrderLabelError(orderId, errorMsg);
    return { labelGenerated: false, labelError: errorMsg };
  }

  if (destFormat && !destFormat.regex.test(normalizedReceiverPhone)) {
    const errorMsg = `Buyer phone must be a valid ${destCountry} mobile number (e.g. ${destFormat.example}). Current number: ${normalizedReceiverPhone}`;
    console.error(`${logPrefix} ${errorMsg}`);
    await updateOrderLabelError(orderId, errorMsg);
    return { labelGenerated: false, labelError: errorMsg };
  }

  // 3. Validate seller phone
  if (normalizedSellerPhone && !isValidPhoneNumber(normalizedSellerPhone)) {
    console.error(`${logPrefix} Invalid seller phone: ${seller.phone} -> ${normalizedSellerPhone}`);
    const errorMsg = 'Invalid seller phone number. Please update your phone in Account Settings.';
    await updateOrderLabelError(orderId, errorMsg);
    return { labelGenerated: false, labelError: errorMsg };
  }

  // 4. Validate countries
  if (!seller.country || !BALTIC_COUNTRIES.includes(seller.country)) {
    await updateOrderLabelError(orderId, 'Seller country not set. Please update your country in Account Settings.');
    return { labelGenerated: false, labelError: 'Seller country not set' };
  }

  if (!destination.country || !BALTIC_COUNTRIES.includes(destination.country)) {
    await updateOrderLabelError(orderId, 'Destination country missing on order.');
    return { labelGenerated: false, labelError: 'Destination country missing' };
  }

  // 5. Generate label
  console.log(`${logPrefix} Generating label...`);
  console.log(`${logPrefix} Sender: ${seller.fullName}, Phone: ${seller.phone} -> ${normalizedSellerPhone}, Country: ${seller.country}`);
  console.log(`${logPrefix} Receiver: ${receiver.name}, Phone: ${receiver.phone} -> ${normalizedReceiverPhone}, Country: ${destination.country}`);
  console.log(`${logPrefix} Terminal: ${destination.terminalId || '(empty)'}, Parcel Size: ${parcelSize || UNISEND_DEFAULT_PARCEL_SIZE}`);

  try {
    const labelResult = await generateShippingLabel({
      orderId,
      orderNumber,
      senderName: seller.fullName,
      senderPhone: normalizedSellerPhone,
      senderCountry: seller.country as 'LT' | 'LV' | 'EE',
      receiverName: receiver.name,
      receiverPhone: normalizedReceiverPhone,
      receiverCountry: destination.country as 'LT' | 'LV' | 'EE',
      destinationTerminalId: destination.terminalId,
      parcelSize: (parcelSize as ParcelSize) || UNISEND_DEFAULT_PARCEL_SIZE,
    });

    console.log(`${logPrefix} Label generated: ParcelId ${labelResult.parcelId}`);

    // 6. Update order with shipping data
    const updateResult = await updateOrderWithShippingData(orderId, {
      parcelId: labelResult.parcelId,
      barcode: labelResult.barcode,
      trackingUrl: labelResult.trackingUrl,
      labelUrl: labelResult.labelUrl,
    });

    if (!updateResult.success) {
      console.error(`${logPrefix} Failed to save shipping data:`, updateResult.error);
      return {
        labelGenerated: false,
        labelError: `Label generated but failed to save: ${updateResult.error}`,
        trackingNumber: labelResult.barcode,
        trackingUrl: labelResult.trackingUrl,
      };
    }

    // 7. Send shipping email to seller (non-blocking)
    sendShippingLabelToSeller({
      sellerName: seller.fullName,
      sellerEmail: seller.email,
      orderNumber,
      orderId,
      buyerName: buyer.fullName,
      destinationTerminalName: destination.terminalName,
      destinationTerminalAddress: destination.terminalAddress,
      parcelId: String(labelResult.parcelId),
      barcode: labelResult.barcode,
      trackingUrl: labelResult.trackingUrl,
    }).catch((err) => {
      console.error(`${logPrefix} Failed to send shipping email:`, err);
    });

    return {
      labelGenerated: true,
      trackingNumber: labelResult.barcode,
      trackingUrl: labelResult.trackingUrl,
      parcelId: labelResult.parcelId,
      barcode: labelResult.barcode,
      labelUrl: labelResult.labelUrl,
    };
  } catch (error) {
    console.error(`${logPrefix} Label generation failed:`, error);

    const errorMessage = formatLabelError(error);
    if (error instanceof UnisendValidationError) {
      console.error(`${logPrefix} Validation errors:`, error.validationErrors);
    }

    await updateOrderLabelError(orderId, errorMessage);

    return { labelGenerated: false, labelError: errorMessage };
  }
}
