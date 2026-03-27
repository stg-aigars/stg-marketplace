/**
 * Wanted Listing Created — Buyer
 * Sent when a seller creates a listing from an accepted wanted offer.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface WantedListingCreatedProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  listingUrl: string;
}

export function WantedListingCreated({
  buyerName,
  sellerName,
  gameName,
  listingUrl,
}: WantedListingCreatedProps) {
  return (
    <EmailLayout preview={`${gameName} is now listed and ready to buy`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> has listed <strong>{gameName}</strong> at
        your agreed price. The game is ready for you to purchase.
      </Text>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
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
    </EmailLayout>
  );
}
