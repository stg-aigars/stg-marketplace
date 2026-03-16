/**
 * Unisend Label Generation Service
 * Handles creating parcels, generating labels, and storing them
 */

import { getUnisendClient } from './client';
import { PHONE_FORMATS } from './types';
import type { CreateParcelRequest } from './types';
import { isValidPhoneNumber } from '@/lib/phone-utils';
import { createClient } from '@supabase/supabase-js';

/**
 * Construct the public tracking URL for a given barcode
 * Format: https://www.post.lt/siuntu-sekimas/?parcels={barcode}
 * Only works with valid barcodes (13 chars: 2 letters + 9 digits + LT)
 */
export function getTrackingUrl(barcode: string | undefined): string | undefined {
  if (!barcode || barcode.trim() === '') {
    return undefined;
  }
  return `https://www.post.lt/siuntu-sekimas/?parcels=${encodeURIComponent(barcode)}`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GenerateLabelParams {
  orderId: string;
  orderNumber: string;
  senderName: string;
  senderPhone: string;
  senderCountry: 'LT' | 'LV' | 'EE';
  receiverName: string;
  receiverPhone: string;
  receiverCountry: 'LT' | 'LV' | 'EE';
  destinationTerminalId: string;
  parcelSize: 'XS' | 'S' | 'M' | 'L';
  parcelWeight?: number; // kg
}

interface GenerateLabelResult {
  parcelId: number;
  barcode: string;
  trackingUrl?: string;
  labelUrl: string;
}

/**
 * Generate shipping label for an accepted T2T order
 */
export async function generateShippingLabel(
  params: GenerateLabelParams
): Promise<GenerateLabelResult> {
  const unisend = getUnisendClient();

  // Pre-validate required fields to provide clear error messages
  const validationErrors: string[] = [];

  if (!params.senderPhone || params.senderPhone.trim() === '') {
    validationErrors.push('Seller phone number is missing. Please add your phone number in your profile.');
  } else if (!isValidPhoneNumber(params.senderPhone)) {
    validationErrors.push('Seller phone number format is invalid. Please enter a valid international phone number.');
  }

  const receiverFmt = PHONE_FORMATS[params.receiverCountry];
  if (!params.receiverPhone || params.receiverPhone.trim() === '') {
    validationErrors.push(`Buyer phone number is missing. Expected format: ${receiverFmt?.placeholder ?? 'international mobile'}.`);
  } else if (receiverFmt && !receiverFmt.regex.test(params.receiverPhone)) {
    validationErrors.push(`Buyer phone must be a valid ${params.receiverCountry} mobile (e.g. ${receiverFmt.example}). Got: ${params.receiverPhone}`);
  } else if (!isValidPhoneNumber(params.receiverPhone)) {
    validationErrors.push('Buyer phone number format is invalid.');
  }

  if (!params.destinationTerminalId || params.destinationTerminalId.trim() === '') {
    validationErrors.push('Destination terminal is not set. Please contact support.');
  }

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(' '));
  }

  // Create parcel
  const parcelRequest: CreateParcelRequest = {
    plan: {
      code: 'TERMINAL',
    },
    sender: {
      name: params.senderName,
      address: {
        countryCode: params.senderCountry,
      },
      contacts: {
        phone: params.senderPhone,
      },
    },
    receiver: {
      name: params.receiverName,
      address: {
        countryCode: params.receiverCountry,
        terminalId: params.destinationTerminalId,
      },
      contacts: {
        phone: params.receiverPhone,
      },
    },
    parcel: {
      type: 'T2T',
      size: params.parcelSize,
      weight: params.parcelWeight || 2, // Default 2kg if not specified
    },
  };

  const { parcelId, barcode, trackingUrl } = await unisend.createAndShipParcel(parcelRequest);

  // Note: We no longer generate/store the label PDF here
  // The seller will print the label at their nearest Unisend terminal using the parcelId
  // This is the standard Unisend T2T workflow

  // We'll use the parcelId as a "label URL" placeholder - the seller doesn't need an actual PDF
  // They'll go to a terminal, enter parcelId, and print from there
  const labelUrl = `unisend://terminal/${parcelId}`;

  // Construct tracking URL from barcode if available
  // For T2T parcels, the barcode is assigned when seller prints at terminal
  // Format: https://www.post.lt/siuntu-sekimas/?parcels={barcode}
  const finalTrackingUrl = trackingUrl || getTrackingUrl(barcode);

  return {
    parcelId,
    barcode,
    trackingUrl: finalTrackingUrl,
    labelUrl,
  };
}

/**
 * Update order with shipping label data
 * Uses service role client to bypass RLS
 */
export async function updateOrderWithShippingData(
  orderId: string,
  data: {
    parcelId: number;
    barcode?: string;
    trackingUrl?: string;
    labelUrl: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('orders')
    .update({
      unisend_parcel_id: data.parcelId,
      barcode: data.barcode,
      tracking_url: data.trackingUrl,
      label_url: data.labelUrl,
      label_generated_at: new Date().toISOString(),
      label_error: null,
    })
    .eq('id', orderId);

  if (error) {
    console.error('[Unisend] Failed to update order:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Store label error in database
 * Uses service role client to bypass RLS
 */
export async function updateOrderLabelError(
  orderId: string,
  labelError: string
): Promise<void> {
  await supabase
    .from('orders')
    .update({ label_error: labelError })
    .eq('id', orderId);
}

/**
 * Get label PDF as buffer (for email attachment)
 */
export async function getLabelPdfBuffer(labelUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(labelUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch label: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[Unisend] Failed to get label PDF:', error);
    throw error;
  }
}

/**
 * Download label directly from storage
 */
export async function downloadLabelFromStorage(orderId: string): Promise<Blob | null> {
  // Find the label file for this order
  const { data: files, error: listError } = await supabase.storage
    .from('order-documents')
    .list('shipping-labels', {
      search: orderId,
    });

  if (listError || !files || files.length === 0) {
    return null;
  }

  // Get the first matching file
  const fileName = files[0].name;
  const filePath = `shipping-labels/${fileName}`;

  const { data, error } = await supabase.storage
    .from('order-documents')
    .download(filePath);

  if (error) {
    console.error('[Unisend] Failed to download label:', error);
    return null;
  }

  return data;
}
