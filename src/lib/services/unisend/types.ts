/**
 * Unisend API Types
 * Terminal-to-Terminal (T2T) shipping for Baltic states (LT, LV, EE)
 */

// ============================================
// Authentication
// ============================================

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // seconds
}

// ============================================
// Terminals
// ============================================

export interface Terminal {
  id: string;
  name: string;
  countryCode: 'LT' | 'LV' | 'EE';
  city: string;
  address: string;
  postalCode: string;
  boxes: ParcelSize[]; // Available box sizes at this terminal
  latitude: string;
  longitude: string;
  servicingHours: string;
  comment?: string;
}

export type TerminalCountry = 'LT' | 'LV' | 'EE';

// ============================================
// Parcels
// ============================================

export type ParcelSize = 'XS' | 'S' | 'M' | 'L';

/** Default parcel size for all Unisend shipments. M fits most board games. */
export const UNISEND_DEFAULT_PARCEL_SIZE: ParcelSize = 'M';

export type ParcelType = 'T2T' | 'H2H' | 'P2H' | 'H2F';

export type PlanCode = 'TERMINAL' | 'HANDS' | 'SIGNED' | 'TRACKED' | 'UNTRACKED';

export interface CreateParcelRequest {
  plan: {
    code: PlanCode;
  };
  parcel: {
    type: ParcelType;
    size?: ParcelSize;
    weight?: number;
  };
  services?: Array<{
    code: string;
    value?: string;
  }>;
  sender: {
    name: string;
    address?: {
      countryCode: TerminalCountry;
    };
    contacts: {
      phone: string;
      email?: string;
    };
  };
  receiver: {
    name: string;
    address: {
      countryCode: TerminalCountry;
      terminalId: string;
    };
    contacts: {
      phone: string;
      email?: string;
    };
  };
}

export interface ParcelResponse {
  parcelId: number;
  warnings?: string[];
}

// ============================================
// Shipping
// ============================================

export interface ShippingInitiateRequest {
  parcelIds: number[];
}

export interface ShippingInitiateResponse {
  requestId: string;
  status?: 'IN_PROGRESS' | 'SUCCESSFUL' | 'PARTIALLY_SUCCESSFUL' | 'ERROR';
  parcels?: Array<{
    parcelId: number;
    barcode?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  }>;
}

export interface BarcodeInfo {
  parcelId: string;
  barcode: string;
  trackingUrl?: string;
}

export type LabelLayout = 'LAYOUT_10x15' | 'LAYOUT_A4' | 'LAYOUT_MAX';

export type LabelOrientation = 'LANDSCAPE' | 'PORTRAIT';

// ============================================
// Tracking
// ============================================

export type TrackingStateType =
  | 'LABEL_CREATED'
  | 'ON_THE_WAY'
  | 'PARCEL_RECEIVED'
  | 'PARCEL_DELIVERED'
  | 'PARCEL_CANCELED'
  | 'RETURNING';

export interface TrackingEvent {
  eventType: string;
  stateType: TrackingStateType;
  stateText: string;
  timestamp: string;
  location?: string;
  description?: string;
}

// ============================================
// Errors
// ============================================

export interface ValidationErrorItem {
  field: string;
  error: string;
  error_description?: string;
}

export interface ApiErrorResponse {
  error: string;
  error_description?: string;
  validationErrors?: ValidationErrorItem[];
}

export class UnisendValidationError extends Error {
  validationErrors: ValidationErrorItem[];

  constructor(message: string, validationErrors: ValidationErrorItem[]) {
    super(message);
    this.name = 'UnisendValidationError';
    this.validationErrors = validationErrors;
  }
}

export class UnisendApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'UnisendApiError';
    this.statusCode = statusCode;
  }
}

// ============================================
// Phone Validation
// ============================================

export interface PhoneFormat {
  regex: RegExp;
  example: string;
  placeholder: string;
}

export const PHONE_FORMATS: Record<TerminalCountry, PhoneFormat> = {
  LT: {
    regex: /^\+3706\d{7}$/,
    example: '+37060012345',
    placeholder: '+3706XXXXXXX',
  },
  LV: {
    regex: /^\+3712\d{7}$/,
    example: '+37120012345',
    placeholder: '+3712XXXXXXX',
  },
  EE: {
    regex: /^\+3725\d{6,7}$/,
    example: '+3725012345',
    placeholder: '+3725XXXXXX',
  },
};

// ============================================
// Shipping Price Matrix
// ============================================

// Shipping prices in EUR per route (price is the same regardless of parcel size)
export const SHIPPING_PRICES: Record<TerminalCountry, Record<TerminalCountry, number>> = {
  LT: { LT: 2.70, LV: 2.50, EE: 2.70 },
  LV: { LT: 2.10, LV: 1.90, EE: 2.10 },
  EE: { LT: 3.50, LV: 3.20, EE: 2.80 },
};

// Get shipping price for a route
export function getShippingPrice(
  senderCountry: TerminalCountry,
  receiverCountry: TerminalCountry,
): number | null {
  return SHIPPING_PRICES[senderCountry]?.[receiverCountry] ?? null;
}

// ============================================
// Parcel Size Info
// ============================================

export interface ParcelSizeInfo {
  size: ParcelSize;
  dimensions: string; // LxWxH in cm
  maxWeight: string;
  description: string;
}

export const PARCEL_SIZES: ParcelSizeInfo[] = [
  {
    size: 'XS',
    dimensions: '38x14x64 cm',
    maxWeight: '10 kg',
    description: 'Extra small - fits small card games',
  },
  {
    size: 'S',
    dimensions: '38x19x64 cm',
    maxWeight: '20 kg',
    description: 'Small - fits most standard board games',
  },
  {
    size: 'M',
    dimensions: '38x39x64 cm',
    maxWeight: '30 kg',
    description: 'Medium - fits large board games or 2-3 standard games',
  },
  {
    size: 'L',
    dimensions: '35x61x74 cm',
    maxWeight: '30 kg',
    description: 'Large - fits multiple games or oversized boxes',
  },
];

// ============================================
// UI Helpers
// ============================================

// Tracking state colors for UI
export const TRACKING_STATE_COLORS: Record<TrackingStateType, string> = {
  LABEL_CREATED: 'blue',
  PARCEL_RECEIVED: 'purple',
  ON_THE_WAY: 'yellow',
  PARCEL_DELIVERED: 'green',
  PARCEL_CANCELED: 'red',
  RETURNING: 'orange',
};

// User-friendly field names for validation errors
export const FIELD_NAME_MAP: Record<string, string> = {
  'receiver.contacts.phone': 'Buyer phone number',
  'receiver.contacts.email': 'Buyer email',
  'receiver.name': 'Buyer name',
  'receiver.address.terminalId': 'Destination terminal',
  'receiver.address.countryCode': 'Destination country',
  'sender.contacts.phone': 'Seller phone number',
  'sender.contacts.email': 'Seller email',
  'sender.name': 'Seller name',
  'sender.address.countryCode': 'Sender country',
  'parcel.size': 'Parcel size',
  'parcel.type': 'Parcel type',
  'parcel.weight': 'Parcel weight',
  'plan.code': 'Shipping plan',
};

// User-friendly error messages
export const ERROR_MESSAGES: Record<string, string> = {
  INCORRECT_RECEIVER: 'Please check the recipient information',
  TERMINAL_NOT_FOUND: 'Selected terminal is no longer available. Please choose another.',
  UNAUTHORIZED: 'Session expired. Please try again.',
  SERVICE_UNAVAILABLE: 'Shipping service temporarily unavailable. Please try again later.',
  NETWORK_ERROR: 'Connection error. Please check your internet and try again.',
};

export function getUserFriendlyFieldName(field: string): string {
  return FIELD_NAME_MAP[field] || field;
}

export function getUserFriendlyErrorMessage(error: string): string {
  return ERROR_MESSAGES[error] || error;
}
