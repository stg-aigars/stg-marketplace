import type { Config } from "tailwindcss";
import { colors, typography, borderRadius, shadows } from "./src/styles/tokens";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        polar: {
          night: colors.polar.night,
          'night-light': colors.polar.nightLight,
          'night-medium': colors.polar.nightMedium,
          'night-dark': colors.polar.nightDark,
        },
        snow: {
          storm: colors.snow.storm,
          'storm-light': colors.snow.stormLight,
          'storm-lightest': colors.snow.stormLightest,
          white: colors.snow.white,
        },
        frost: {
          ice: colors.frost.ice,
          polar: colors.frost.polar,
          arctic: colors.frost.arctic,
          ocean: colors.frost.ocean,
        },
        aurora: {
          orange: colors.aurora.orange,
          green: colors.aurora.green,
          red: colors.aurora.red,
          yellow: colors.aurora.yellow,
          purple: colors.aurora.purple,
        },
        semantic: {
          primary: colors.semantic.primary,
          'primary-hover': colors.semantic.primaryHover,
          'primary-active': colors.semantic.primaryActive,
          trust: colors.semantic.trust,
          'trust-hover': colors.semantic.trustHover,
          'trust-active': colors.semantic.trustActive,
          success: colors.semantic.success,
          'success-hover': colors.semantic.successHover,
          error: colors.semantic.error,
          'error-hover': colors.semantic.errorHover,
          warning: colors.semantic.warning,
          'warning-hover': colors.semantic.warningHover,
          'text-heading': colors.semantic.textHeading,
          'text-primary': colors.semantic.textPrimary,
          'text-secondary': colors.semantic.textSecondary,
          'text-muted': colors.semantic.textMuted,
          'text-inverse': colors.semantic.textInverse,
          'bg-primary': colors.semantic.bgPrimary,
          'bg-secondary': colors.semantic.bgSecondary,
          'bg-elevated': colors.semantic.bgElevated,
          'bg-overlay': colors.semantic.bgOverlay,
          'border-subtle': colors.semantic.borderSubtle,
          'border-default': colors.semantic.borderDefault,
          'border-strong': colors.semantic.borderStrong,
          'border-focus': colors.semantic.borderFocus,
        },
        condition: {
          'like-new': colors.condition.likeNew.border,
          'like-new-bg': colors.condition.likeNew.bg,
          'like-new-text': colors.condition.likeNew.text,
          'very-good': colors.condition.veryGood.border,
          'very-good-bg': colors.condition.veryGood.bg,
          'very-good-text': colors.condition.veryGood.text,
          good: colors.condition.good.border,
          'good-bg': colors.condition.good.bg,
          'good-text': colors.condition.good.text,
          acceptable: colors.condition.acceptable.border,
          'acceptable-bg': colors.condition.acceptable.bg,
          'acceptable-text': colors.condition.acceptable.text,
          'for-parts': colors.condition.forParts.border,
          'for-parts-bg': colors.condition.forParts.bg,
          'for-parts-text': colors.condition.forParts.text,
        },
      },
      fontFamily: {
        sans: typography.fontFamily.primary.split(', ').map((f) => f.replace(/^"|"$/g, '')),
      },
      borderRadius: {
        ...borderRadius,
      },
      boxShadow: {
        ...shadows,
      },
    },
  },
  plugins: [],
};
export default config;
