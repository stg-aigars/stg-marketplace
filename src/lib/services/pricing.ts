/**
 * Pricing service
 * Calculates buyer charges, seller earnings, and checkout pricing
 * All amounts in cents to avoid floating-point issues
 */

import { SELLER_COMMISSION_RATE } from '@/lib/pricing/constants';

export interface BuyerPricing {
  itemsTotalCents: number;
  shippingCostCents: number;
  totalChargeCents: number;
}

export interface SellerEarnings {
  itemsTotalCents: number;
  commissionCents: number;
  walletCreditCents: number;
}

export interface OrderPricing extends BuyerPricing, SellerEarnings {}

export interface CheckoutPricing extends BuyerPricing {
  walletDebitCents: number;
  everypayChargeCents: number;
}

/** Buyer pays: item price + shipping. No service fee. */
export function calculateBuyerPricing(
  itemsTotalCents: number,
  shippingCostCents: number
): BuyerPricing {
  return {
    itemsTotalCents,
    shippingCostCents,
    totalChargeCents: itemsTotalCents + shippingCostCents,
  };
}

/** Seller receives: item price - 10% commission */
export function calculateSellerEarnings(itemsTotalCents: number): SellerEarnings {
  const commissionCents = Math.round(itemsTotalCents * SELLER_COMMISSION_RATE);
  return {
    itemsTotalCents,
    commissionCents,
    walletCreditCents: itemsTotalCents - commissionCents,
  };
}

/** Full order pricing (buyer + seller sides) */
export function calculateOrderPricing(
  itemsTotalCents: number,
  shippingCostCents: number
): OrderPricing {
  return { ...calculateBuyerPricing(itemsTotalCents, shippingCostCents), ...calculateSellerEarnings(itemsTotalCents) };
}

/** Checkout pricing with wallet balance applied */
export function calculateCheckoutPricing(
  itemsTotalCents: number,
  shippingCostCents: number,
  walletBalanceCents: number
): CheckoutPricing {
  const buyer = calculateBuyerPricing(itemsTotalCents, shippingCostCents);
  const walletDebitCents = Math.min(walletBalanceCents, buyer.totalChargeCents);
  return { ...buyer, walletDebitCents, everypayChargeCents: buyer.totalChargeCents - walletDebitCents };
}

/** Format euro amount: formatPrice(25.5) => "25,50 €" */
export function formatPrice(euros: number): string {
  return `${euros.toFixed(2).replace('.', ',')} €`;
}

/** Format cents to euros string: formatCentsToEuros(2550) => "25,50" */
export function formatCentsToEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Format cents to currency: formatCentsToCurrency(2550) => "25,50 €" */
export function formatCentsToCurrency(cents: number): string {
  return formatPrice(cents / 100);
}

// VAT rates by seller's country
export const VAT_RATES: Record<string, number> = { LV: 0.21, LT: 0.21, EE: 0.24 };
export const DEFAULT_VAT_RATE = 0.21;

export interface VatSplit {
  grossCents: number;
  netCents: number;
  vatCents: number;
  vatRate: number;
}

export function getVatRate(country: string | null | undefined): number {
  if (!country) return DEFAULT_VAT_RATE;
  return VAT_RATES[country.toUpperCase()] ?? DEFAULT_VAT_RATE;
}

export function calculateVatSplit(grossCents: number, vatRate: number): VatSplit {
  const netCents = Math.round(grossCents / (1 + vatRate));
  return { grossCents, netCents, vatCents: grossCents - netCents, vatRate };
}
