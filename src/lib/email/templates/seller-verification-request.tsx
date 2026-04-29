/**
 * Seller Verification Request — Soft-touch email per lawyer correspondence 2026-04-28.
 * Filed memo: docs/legal_audit/trader-detection-deferral.md
 *
 * Tone: warm, community-vibe. Stiff legal Latvian undermines the C2C-platform
 * defense as much as the underlying logic. Most recipients are collectors
 * thinning shelves; the email frames the question that way and treats the
 * trader case as a normal alternative, not an accusation.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface SellerVerificationRequestProps {
  sellerFirstName: string;
  salesCount: number;
  appUrl: string;
  responseDeadlineDays: number;
}

export function SellerVerificationRequest({
  sellerFirstName,
  salesCount,
  appUrl,
  responseDeadlineDays,
}: SellerVerificationRequestProps) {
  return (
    <EmailLayout preview="A quick question about your selling on Second Turn Games">
      <Text style={s.greeting}>Hey {sellerFirstName},</Text>

      <Text style={s.body}>
        We&apos;ve noticed you&apos;ve been doing quite a bit of selling on Second Turn Games
        lately — {salesCount} games over the past year, which is fantastic for the community.
        Pre-loved games finding new homes is exactly what we&apos;re here for.
      </Text>

      <Text style={s.body}>
        We just need to ask a quick question to keep our paperwork straight. The short
        version: EU consumer law treats people who sell games <strong>as a business or trade</strong>{' '}
        differently from people who sell <strong>from their personal collection</strong>.
        Most of our community sits squarely in the second group — collectors thinning shelves,
        parents passing on games their kids outgrew, that kind of thing. But we need to confirm
        with you which side of that line you&apos;re on.
      </Text>

      <Text style={s.body}>Could you take 30 seconds to let us know?</Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={`${appUrl}/account/seller-verification`}>
          Answer the question
        </Button>
      </div>

      <Text style={s.note}>
        If you don&apos;t reply within {responseDeadlineDays} days, we&apos;ll reach out again.
        If you&apos;re a trader, that&apos;s totally fine — we&apos;ll just switch on the trader
        features in your account so buyers see your business details and get the 14-day
        return rights they&apos;re entitled to.
      </Text>

      <Text style={s.body}>
        Thanks for being part of the community.
        <br />
        — The Second Turn Games team
      </Text>
    </EmailLayout>
  );
}

export default SellerVerificationRequest;
