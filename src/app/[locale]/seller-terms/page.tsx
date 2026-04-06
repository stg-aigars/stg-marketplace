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
          <p>To sell on Second Turn Games you must be at least 18, reside in Latvia, Lithuania, or
            Estonia, and be a private individual (not a business). The platform is for selling
            personal items, not for buying and reselling for profit. By creating a listing you
            confirm you meet these requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Payment authorization
          </h2>
          <p>
            By listing an item, you authorize Second Turn Games SIA to receive payments from buyers
            on your behalf, acting as your commercial agent under PSD2 Article 3(b). Funds are held
            by the platform until the transaction is completed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Operational requirements
          </h2>
          <p>When an order is placed, you must:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Confirm or decline the order within 48 hours. Orders not confirmed in time are
              automatically cancelled with a full refund to the buyer
            </li>
            <li>
              Ship the item within 5 days of accepting. You will get a reminder on day 3. Orders not
              shipped by day 5 are automatically cancelled and the buyer is refunded
            </li>
            <li>
              Use the provided Unisend shipping code for all deliveries
            </li>
            <li>
              Package items securely. You are liable for transit damage caused by poor packaging
            </li>
            <li>
              Describe items accurately, including condition, edition, language, and any defects.
              Misrepresentation may lead to disputes, refunds, or account suspension
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
            STG may suspend or terminate your selling privileges for:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Fraud or deceptive practices</li>
            <li>Repeatedly misrepresenting item condition or details</li>
            <li>Failing to ship accepted orders</li>
            <li>Excessive chargebacks or disputes</li>
            <li>Suspected commercial activity (buying to resell for profit)</li>
          </ul>
          <p>
            On suspension or termination, pending payouts may be held for up to 180 days to cover
            chargebacks, refunds, or unresolved disputes.
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
            Under the EU DAC7 directive (Council Directive 2021/514), STG may need to report seller
            information to the Latvian State Revenue Service (VID) once you reach 30 transactions or
            &euro;2,000 in sales per calendar year. If this applies to you, we will let you know and
            ask for your full legal name, date of birth, address, and tax identification number. If
            you do not provide this information, we may have to suspend your selling privileges.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Changes to this agreement
          </h2>
          <p>
            We may update this agreement. For material changes (fees, commission rates, seller
            obligations) we will email you at least 14 days before they take effect. Continued
            selling after the notice period means you accept the updated terms.
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
