import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Seller Agreement',
};

export default function SellerTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Seller Agreement
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: 6 April 2026
        </p>

        <p>
          This Seller Agreement supplements the general{' '}
          <Link
            href="/terms"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
          >
            Terms of Service
          </Link>
          . By creating a listing on Second Turn Games, you agree to these additional terms.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. Eligibility
          </h2>
          <p>To sell on Second Turn Games, you must:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Be at least 18 years old</li>
            <li>Be a private individual (not a business or professional trader)</li>
            <li>Reside in Latvia, Lithuania, or Estonia</li>
            <li>Be selling personal items, not purchasing items to resell for profit</li>
          </ul>
          <p>
            By creating a listing, you confirm that you meet these requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Payment authorization
          </h2>
          <p>
            By listing an item, you authorize Second Turn Games SIA to act as your commercial agent
            under PSD2 Article 3(b) to receive payments from buyers on your behalf. Buyer funds are
            held securely by the platform until the transaction is completed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Operational requirements
          </h2>
          <p>When an order is placed, you must:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Confirm or decline</strong> the order within 24 hours. Orders not confirmed
              within this period may be automatically cancelled with a full refund to the buyer
            </li>
            <li>
              <strong>Ship</strong> the item within the agreed timeframe after accepting the order.
              Orders not shipped in time may be automatically cancelled
            </li>
            <li>
              <strong>Use the provided Unisend shipping labels</strong> for all deliveries. Do not
              arrange alternative shipping
            </li>
            <li>
              <strong>Package items securely.</strong> You are liable for damage that occurs during
              transit due to inadequate packaging
            </li>
            <li>
              <strong>Describe items accurately,</strong> including condition, edition, language, and
              any defects. Misrepresentation may result in disputes, refunds, or account suspension
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            4. Fees and commissions
          </h2>
          <p>
            STG charges a flat 10% commission on the item price. The commission does not apply to
            shipping costs. There are no listing fees.
          </p>
          <p>
            For example, if you list an item for &euro;20.00, the commission is &euro;2.00 and you
            receive &euro;18.00. The buyer pays the item price plus shipping separately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            5. Wallet and payouts
          </h2>
          <p>
            Your earnings (item price minus 10% commission) are credited to your platform wallet
            after the order is completed. An order is completed when the buyer confirms delivery or
            the 2-day dispute window closes without a dispute being raised.
          </p>
          <p>
            You may withdraw your wallet balance to your bank account (IBAN). Withdrawals are
            typically processed within 1&ndash;3 business days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            6. Suspension and termination
          </h2>
          <p>
            STG may suspend or terminate your selling privileges for any of the following:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Fraud or deceptive practices</li>
            <li>Repeatedly misrepresenting item condition or details</li>
            <li>Failing to ship accepted orders</li>
            <li>Excessive chargebacks or disputes</li>
            <li>Suspected commercial activity (buying to resell for profit)</li>
          </ul>
          <p>
            Upon suspension or termination, any pending payouts may be held for up to 180 days to
            cover potential chargebacks, refunds, or unresolved disputes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Tax obligations
          </h2>
          <p>
            You are responsible for reporting your sales income in accordance with the tax laws of
            your country of residence. STG does not provide tax advice.
          </p>
          <p>
            Under the EU DAC7 directive (Council Directive 2021/514), STG may be required to report
            seller information to the Latvian State Revenue Service (VID) when you reach certain
            thresholds (30 or more transactions or &euro;2,000 or more in sales per calendar year).
            If reporting is required, we will notify you and may request additional information such
            as your full legal name, date of birth, address, and tax identification number. Failure
            to provide required information may result in your selling privileges being suspended.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Changes to this agreement
          </h2>
          <p>
            We may update this agreement from time to time. Material changes &mdash; including
            changes to fees, commission rates, or seller obligations &mdash; will be communicated
            via email with at least 14 days notice. Continued selling after the notice period
            constitutes acceptance of the updated terms.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link
            href="/terms"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
