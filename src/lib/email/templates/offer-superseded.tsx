/**
 * Offer Superseded Notification — Buyer
 * Sent when the seller lists the game on the marketplace, automatically
 * closing the buyer's open offer.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface OfferSupersededProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  listingUrl: string;
}

export function OfferSuperseded({
  buyerName,
  sellerName,
  gameName,
  listingUrl,
}: OfferSupersededProps) {
  return (
    <EmailLayout preview={`${sellerName} listed ${gameName} on the marketplace`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> has listed <strong>{gameName}</strong> on
        the marketplace. Your offer has been automatically closed.
      </Text>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={listingUrl} style={templateStyles.ctaFrost}>
                View listing
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You can purchase the game directly at the listed price.
      </Text>
    </EmailLayout>
  );
}
