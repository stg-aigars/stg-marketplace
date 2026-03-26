/**
 * Offer Deadline Expired Notification — Buyer
 * Sent when an accepted offer expires because the seller did not create
 * a listing within the 3-day deadline.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface OfferDeadlineExpiredProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  offersUrl: string;
}

export function OfferDeadlineExpired({
  buyerName,
  sellerName,
  gameName,
  offersUrl,
}: OfferDeadlineExpiredProps) {
  return (
    <EmailLayout
      preview={`Accepted offer on ${gameName} expired — listing not created`}
    >
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        Your accepted offer on <strong>{gameName}</strong> has expired because{' '}
        <strong>{sellerName}</strong> did not create a listing within 3 days.
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
              <Link href={offersUrl} style={templateStyles.ctaFrost}>
                View your offers
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You can make a new offer if the game is still available on their shelf.
      </Text>
    </EmailLayout>
  );
}
