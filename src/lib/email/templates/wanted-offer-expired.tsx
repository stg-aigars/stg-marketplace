/**
 * Wanted Offer Expired — Seller
 * Sent when a seller's offer on a wanted listing expires (7-day TTL).
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface WantedOfferExpiredProps {
  sellerName: string;
  gameName: string;
  wantedUrl: string;
}

export function WantedOfferExpired({
  sellerName,
  gameName,
  wantedUrl,
}: WantedOfferExpiredProps) {
  return (
    <EmailLayout preview={`Your offer for ${gameName} has expired`}>
      <Text style={templateStyles.greeting}>Hi {sellerName},</Text>

      <Text style={templateStyles.body}>
        Your offer for <strong>{gameName}</strong> has expired because the buyer
        did not respond within 7 days.
      </Text>

      <Text style={templateStyles.body}>
        If you are still interested, you can make a new offer on the wanted listing.
      </Text>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={wantedUrl} style={templateStyles.ctaFrost}>
                Browse wanted games
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
