/**
 * Shared email layout
 * Header with brand, footer with links, consistent typography.
 * Reused across all transactional email templates.
 *
 * Uses explicit HTML table width attributes instead of CSS max-width,
 * because many desktop webmail clients ignore CSS max-width on tables.
 */

import {
  Body,
  Head,
  Html,
  Link,
  Preview,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';
import { env } from '@/lib/env';

// Nordic design tokens for email (inline styles, no Tailwind in email)
const theme = {
  bgPage: '#ECEFF4',        // snow.stormLightest — page background
  bgCard: '#FEFEFE',        // snow.white — card backgrounds
  bgElevated: '#E5E9F0',   // snow.stormLight — elevated surfaces (order detail cards)
  textHeading: '#2E3440',
  textPrimary: '#3B4252',
  textSecondary: '#434C5E',
  textMuted: '#4C566A',
  borderSubtle: '#D8DEE9',  // snow.storm
  frost: '#88C0D0',
  frostDark: '#5E81AC',
  orange: '#D08770',
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const EMAIL_WIDTH = 600;

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        {/* Outer table: full-width wrapper for centering */}
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ margin: 0, padding: 0 }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: '40px 16px' }}>
                {/* Inner table: fixed 600px width — the white card */}
                <table
                  role="presentation"
                  width={EMAIL_WIDTH}
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  style={styles.card}
                >
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td style={styles.header}>
                        <Text style={styles.logo}>Second Turn Games</Text>
                        <Text style={styles.tagline}>Every game deserves a second turn</Text>
                      </td>
                    </tr>

                    {/* Divider */}
                    <tr>
                      <td style={{ padding: '0 32px' }}>
                        <Hr style={styles.hr} />
                      </td>
                    </tr>

                    {/* Content */}
                    <tr>
                      <td style={styles.content}>
                        {children}
                      </td>
                    </tr>

                    {/* Divider */}
                    <tr>
                      <td style={{ padding: '0 32px' }}>
                        <Hr style={styles.hr} />
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={styles.footer}>
                        <Text style={styles.footerLinks}>
                          <Link href={`${env.app.url}/browse`} style={styles.footerLink}>Browse Games</Link>
                          {' · '}
                          <Link href={`${env.app.url}/sell`} style={styles.footerLink}>Sell a Game</Link>
                          {' · '}
                          <Link href={`${env.app.url}/account/orders`} style={styles.footerLink}>My Orders</Link>
                        </Text>
                        <Text style={styles.footerText}>
                          Second Turn Games — peer-to-peer board game marketplace for the Baltic region
                        </Text>
                        <Text style={styles.footerText}>
                          Latvia · Lithuania · Estonia
                        </Text>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: theme.bgPage,
    fontFamily: theme.fontFamily,
    margin: '0' as const,
    padding: '0' as const,
  },
  card: {
    backgroundColor: theme.bgCard,
    border: `1px solid ${theme.borderSubtle}`,
    borderRadius: '8px',
  },
  header: {
    padding: '32px 32px 16px',
    textAlign: 'center' as const,
  },
  logo: {
    color: theme.textHeading,
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '-0.3px',
    margin: '0',
  },
  tagline: {
    color: theme.textMuted,
    fontSize: '13px',
    fontWeight: '400',
    margin: '4px 0 0',
  },
  hr: {
    borderColor: theme.borderSubtle,
    borderTop: 'none',
    margin: '0',
  },
  content: {
    padding: '24px 32px 32px',
  },
  footer: {
    padding: '16px 32px 32px',
    textAlign: 'center' as const,
  },
  footerLinks: {
    color: theme.textMuted,
    fontSize: '13px',
    margin: '0 0 12px',
  },
  footerLink: {
    color: theme.frostDark,
    textDecoration: 'none',
  },
  footerText: {
    color: theme.textMuted,
    fontSize: '12px',
    lineHeight: '18px',
    margin: '0',
  },
} as const;

// Shared styles for template content — avoids duplication across templates
const templateStyles = {
  greeting: {
    color: theme.textHeading,
    fontSize: '16px',
    fontWeight: '600' as const,
    margin: '0 0 16px',
  },
  body: {
    color: theme.textPrimary,
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  orderCard: {
    backgroundColor: theme.bgElevated,
    borderRadius: '8px',
    padding: '20px 24px',
    margin: '0 0 24px',
  },
  orderLabel: {
    color: theme.textMuted,
    fontSize: '12px',
    fontWeight: '500' as const,
    letterSpacing: '0.5px',
    margin: '0',
    textTransform: 'uppercase' as const,
  },
  orderNumber: {
    color: theme.textHeading,
    fontSize: '18px',
    fontWeight: '700' as const,
    margin: '2px 0 16px',
  },
  detailLabel: {
    color: theme.textMuted,
    fontSize: '13px',
    margin: '0',
  },
  detailValue: {
    color: theme.textPrimary,
    fontSize: '15px',
    fontWeight: '500' as const,
    margin: '2px 0 12px',
  },
  ctaSection: {
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
  note: {
    color: theme.textMuted,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
  },
  stepList: {
    color: theme.textSecondary,
    fontSize: '14px',
    lineHeight: '24px',
    margin: '0 0 24px',
    whiteSpace: 'pre-line' as const,
  },
  ctaFrost: {
    backgroundColor: theme.frost,
    borderRadius: '8px',
    color: theme.bgCard,
    display: 'inline-block' as const,
    fontSize: '15px',
    fontWeight: '600' as const,
    padding: '12px 32px',
    textDecoration: 'none',
  },
  ctaOrange: {
    backgroundColor: theme.orange,
    borderRadius: '8px',
    color: theme.bgCard,
    display: 'inline-block' as const,
    fontSize: '15px',
    fontWeight: '600' as const,
    padding: '12px 32px',
    textDecoration: 'none',
  },
} as const;

// Export theme + shared styles for use in individual templates
export { theme, templateStyles };
