/**
 * STG Design System Tokens
 * Nordic-minimalist aesthetic. Single source of truth for all visual values.
 * Import these in tailwind.config.ts to extend the default theme.
 */

// Color palette based on Nordic aesthetic with trust-building blues
export const colors = {
  // Nordic Polar Night - Base darks
  polar: {
    night: '#2E3440',      // Primary text, dark mode background
    nightLight: '#3B4252',  // Elevated surfaces in dark mode
    nightMedium: '#434C5E', // Further elevated surfaces
    nightDark: '#4C566A',   // Borders and dividers in dark mode
  },

  // Nordic Snow Storm - Warm parchment base lights
  snow: {
    storm: '#E8E5DF',       // Warm subtle borders and dividers
    stormLight: '#F5F3EF',  // Warm elevated surfaces
    stormLightest: '#FAF9F6', // Warm parchment background
    white: '#FFFFFF',        // True white for cards (contrast with warm bg)
  },

  // Nordic Frost - Primary trust colors (signature brand)
  frost: {
    ice: '#88C0D0',         // Primary brand color - trust, CTAs
    polar: '#81A1C1',       // Hover states, active states
    arctic: '#5E81AC',      // Deep trust - verification badges
    ocean: '#4C7099',       // Pressed states, dark accents
  },

  // Aurora colors - Accents and states
  aurora: {
    orange: '#D08770',      // Urgency, hot deals, primary CTAs
    green: '#A3BE8C',       // Success states only (minimal use)
    red: '#BF616A',         // Errors, rare/collectible items
    yellow: '#EBCB8B',      // Warnings, attention needed
    purple: '#B48EAD',      // Auctions, bidding
  },

  // Semantic colors - mapped from palette
  semantic: {
    primary: '#D08770',           // aurora.orange - CTAs
    primaryHover: '#C97862',
    primaryActive: '#B86954',

    trust: '#88C0D0',             // frost.ice
    trustHover: '#81A1C1',
    trustActive: '#5E81AC',

    // Brand identity (teal) — links, focus, active nav, trust indicators
    brand: '#6BA3B5',
    brandHover: '#5A9AAD',
    brandActive: '#4A8A9C',

    // Warm gold accent — ratings, featured highlights
    accent: '#C9A84C',
    accentBg: '#FBF8EE',

    // Light tint backgrounds for icon containers and highlights
    brandBg: '#EDF5F7',         // Brand teal tint
    primaryBg: '#FBF0EB',       // Primary orange tint
    successBg: '#EEF5EB',       // Success green tint
    warningBg: '#FBF5E6',       // Warning yellow tint
    purpleBg: '#F3EDF5',        // Aurora purple tint

    success: '#A3BE8C',
    successHover: '#95B07D',

    error: '#BF616A',
    errorHover: '#B5525B',

    warning: '#EBCB8B',
    warningHover: '#E4C37C',

    textHeading: '#2E3440',
    textPrimary: '#3B4252',
    textSecondary: '#434C5E',
    textMuted: '#4C566A',
    textInverse: '#FAF9F6',

    bgPrimary: '#FAF9F6',
    bgSecondary: '#F5F3EF',
    bgElevated: '#FFFFFF',
    bgSurface: '#F5F3EF',        // Interactive surfaces (hover menus, overlays on cards)
    bgSubtle: '#FAF9F6',         // Subtle background tint (section alternation)
    bgInput: '#FDFCFA',          // Slightly warm, distinguishes from card white
    bgOverlay: 'rgba(26, 31, 38, 0.5)',

    borderSubtle: '#E8E5DF',
    borderDefault: '#D4CFC7',
    borderStrong: '#C0BAB0',
    borderFocus: '#6BA3B5',       // Brand teal focus ring (was aurora.orange)
  },

  // Condition badge colors
  condition: {
    likeNew: { bg: '#E3EEF4', text: '#5E81AC', border: '#88C0D0' },
    veryGood: { bg: '#E8F3E6', text: '#6B8E5F', border: '#A3BE8C' },
    good: { bg: '#F7F0DB', text: '#9B8556', border: '#EBCB8B' },
    acceptable: { bg: '#F5E3DB', text: '#A66B50', border: '#D08770' },
    forParts: { bg: '#F4DBDC', text: '#9B4B52', border: '#BF616A' },
  },
} as const;

// 8-point grid spacing system
export const spacing = {
  0: '0',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
} as const;

// Typography using Plus Jakarta Sans
export const typography = {
  fontFamily: {
    primary: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    none: 1,
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

// Border radius - moderate warmth
export const borderRadius = {
  none: '0',
  xs: '0.25rem',    // 4px
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px - pills
  full: '9999px',   // Avatars
} as const;

// Shadows - warm Nordic elevation
export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(26, 31, 38, 0.04)',
  sm: '0 1px 3px rgba(26, 31, 38, 0.06)',         // Resting
  md: '0 4px 12px rgba(26, 31, 38, 0.08)',        // Hover
  lg: '0 8px 24px rgba(26, 31, 38, 0.10)',        // Dropdowns
  xl: '0 12px 32px rgba(26, 31, 38, 0.14)',       // Modals
  focus: '0 0 0 3px rgba(107, 163, 181, 0.25)',   // Focus ring (brand teal)
  'glow-primary': '0 2px 8px rgba(208, 135, 112, 0.2)',   // Warm glow beneath primary CTA
  'glow-error': '0 0 0 3px rgba(191, 97, 106, 0.1)',      // Soft red glow for error state
} as const;
