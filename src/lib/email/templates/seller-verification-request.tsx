/**
 * Seller Verification Request — verbatim copy from lawyer correspondence 2026-04-28.
 * Filed memo: docs/legal_audit/trader-detection-deferral.md
 *
 * The trader self-declaration option is deliberately NOT in the structured form
 * (DSA Art. 30 trap: knowing = liability — see deferral memo). Sellers who are
 * commercial reply to this email instead, and support handles wind-down via the
 * support inbox. The on-platform structured response is binary:
 * collector / 'd-rather-not-say.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface SellerVerificationRequestProps {
  sellerFirstName: string;
  salesCount: number;
  appUrl: string;
  // Retained for potential future use; not referenced by the verbatim copy.
  responseDeadlineDays: number;
}

export function SellerVerificationRequest({
  sellerFirstName,
  salesCount,
  appUrl,
}: SellerVerificationRequestProps) {
  return (
    <EmailLayout preview="Checking in: please confirm your account status">
      <Text style={s.greeting}>Hi {sellerFirstName},</Text>

      <Text style={s.body}>
        Wow, you recently crossed {salesCount} sales — you&apos;re officially one of STG&apos;s
        most active sellers!
      </Text>

      <Text style={s.body}>
        Because Second Turn Games is built specifically for private collectors culling their
        personal shelves, EU consumer protection rules require us to occasionally check in
        with high-volume sellers to ensure they aren&apos;t operating as commercial businesses.
      </Text>

      <Text style={s.body}>Could you take 30 seconds to confirm your account status here?</Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={`${appUrl}/account/seller-verification`}>
          Confirm my account status
        </Button>
      </div>

      <Text style={s.note}>
        Note: STG does not currently support commercial accounts. If you are acting as a
        registered business or trader, please reply directly to this email so we can help
        you wrap up any active orders.
      </Text>

      <Text style={s.body}>
        If you have any questions, just hit reply. Thanks for helping us keep the STG community
        awesome!
        <br />
        — The Second Turn Games team
      </Text>
    </EmailLayout>
  );
}

export default SellerVerificationRequest;
