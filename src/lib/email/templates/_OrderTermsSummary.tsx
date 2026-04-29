/**
 * Order Terms Summary — Inline durable medium per ECJ Content Services C-49/11.
 *
 * Renders inside the buyer's order-confirmation email, immediately above the footer.
 * The buyer's email client (Gmail, Apple Mail, etc.) is the durable storage —
 * once delivered, the buyer holds an immutable copy outside merchant reach.
 *
 * Two blocks:
 *   1. Order-governing terms summary — parties, version, withdrawal-rights framing,
 *      dispute path, STG legal-entity contact.
 *   2. Annex B withdrawal-form template — the statutory text, defensively included
 *      so the PTAC §5.2 form-delivery gap is closed even though the private-only
 *      posture means the right does not apply. EN-only at launch (LV/LT/EE land
 *      with locale rollout — deferred-work entry in legal_deferred_work.md).
 *
 * If a future contributor proposes "let's just link to /terms instead," see the
 * defense memo at docs/legal_audit/durable-medium-defense.md before changing this.
 */

import { Text } from '@react-email/components';
import * as React from 'react';
import { theme, templateStyles as s } from './layout';
import { LEGAL_ENTITY_NAME, LEGAL_ENTITY_ADDRESS, LEGAL_ENTITY_REG_NUMBER } from '@/lib/constants';
import type { AdrBody } from '@/lib/legal/adr-bodies';

interface OrderTermsSummaryProps {
  orderNumber: string;
  termsVersion: string;
  sellerTermsVersion: string;
  sellerName: string;
  adr: AdrBody;
}

export function OrderTermsSummary({
  orderNumber,
  termsVersion,
  sellerTermsVersion,
  sellerName,
  adr,
}: OrderTermsSummaryProps) {
  return (
    <div style={styles.container}>
      <Text style={styles.heading}>For your records — order terms summary</Text>

      <Text style={s.body}>
        This message contains the terms that govern your order. Save it. Your email client
        holds an immutable copy — your reference if you ever need to check what we agreed
        to on{' '}
        <strong>{new Date().toISOString().slice(0, 10)}</strong>.
      </Text>

      <div style={styles.section}>
        <Text style={styles.sectionHeading}>Parties and contract version</Text>
        <Text style={s.body}>
          • Buyer: you (the addressee of this email)
          <br />• Seller: <strong>{sellerName}</strong> — a private individual selling from
          their personal collection, not a business or trade
          <br />• Platform: <strong>{LEGAL_ENTITY_NAME}</strong>, {LEGAL_ENTITY_ADDRESS},
          reg. {LEGAL_ENTITY_REG_NUMBER}
          <br />• Terms of Service version: <strong>{termsVersion}</strong>
          <br />• Seller Agreement version: <strong>{sellerTermsVersion}</strong>
          <br />• Order number: <strong>{orderNumber}</strong>
        </Text>
      </div>

      <div style={styles.section}>
        <Text style={styles.sectionHeading}>Withdrawal rights and returns</Text>
        <Text style={s.body}>
          Because the seller is a private individual (not a business or trade), the EU
          14-day withdrawal right under Directive 2011/83/EU does not apply to this sale.
          Disputes about the item — condition, accuracy of the listing, delivery — may be
          raised with us within 2 days of delivery, and we&apos;ll help mediate. If you and
          the seller disagree on whether the seller is acting in a business capacity, you
          may submit the withdrawal-form template (below) within 14 days of delivery; we
          will review per Terms of Service §15 (Trader-status disputes).
        </Text>
      </div>

      <div style={styles.section}>
        <Text style={styles.sectionHeading}>Out-of-court dispute resolution</Text>
        <Text style={s.body}>
          If we cannot resolve a dispute internally, you may take the matter to the consumer
          protection authority of your country of residence:
          <br />
          <strong>{adr.name}</strong> — <a href={adr.url} style={styles.link}>{adr.url}</a>
        </Text>
      </div>

      <div style={styles.annexBox}>
        <Text style={styles.sectionHeading}>Annex B — Withdrawal form template</Text>
        <Text style={styles.annexText}>
          To: {LEGAL_ENTITY_NAME}, {LEGAL_ENTITY_ADDRESS} — info@secondturn.games
          <br />
          <br />
          I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale
          of the following goods (*)/for the provision of the following service (*),
          <br />
          <br />
          Ordered on (*)/received on (*): _____________________
          <br />
          Order number: <strong>{orderNumber}</strong>
          <br />
          Name of consumer(s): _____________________
          <br />
          Address of consumer(s): _____________________
          <br />
          Signature of consumer(s) (only if this form is notified on paper): _____________________
          <br />
          Date: _____________________
          <br />
          <br />
          (*) Delete as appropriate.
        </Text>
        <Text style={styles.annexNote}>
          (Template per Annex B of Cabinet Regulation No. 255 of 2014-05-20, the Latvian
          transposition of Directive 2011/83/EU.)
        </Text>
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: `2px solid ${theme.borderSubtle}`,
  },
  heading: {
    color: theme.textHeading,
    fontSize: '14px',
    fontWeight: '700' as const,
    margin: '0 0 12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  section: {
    margin: '16px 0',
  },
  sectionHeading: {
    color: theme.textHeading,
    fontSize: '13px',
    fontWeight: '600' as const,
    margin: '0 0 6px',
  },
  link: {
    color: theme.frostDark,
    textDecoration: 'underline',
  },
  annexBox: {
    margin: '16px 0',
    padding: '12px',
    backgroundColor: theme.bgElevated,
    border: `1px solid ${theme.borderSubtle}`,
    borderRadius: '6px',
  },
  annexText: {
    color: theme.textSecondary,
    fontSize: '12px',
    fontFamily: 'monospace, monospace',
    lineHeight: '1.6',
    margin: '8px 0',
    whiteSpace: 'pre-wrap' as const,
  },
  annexNote: {
    color: theme.textMuted,
    fontSize: '11px',
    fontStyle: 'italic' as const,
    margin: '8px 0 0',
  },
} as const;

export default OrderTermsSummary;
