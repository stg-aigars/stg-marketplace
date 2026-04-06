import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Privacy Policy
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: 6 April 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. Who we are
          </h2>
          <p>
            Second Turn Games SIA (&ldquo;STG&rdquo;), registration number 50203665371, registered at
            Evalda Valtera iela 5 - 35, Riga, LV-1021, Latvia, is the data controller. This policy
            explains how we collect, use, and protect your personal data under the General Data
            Protection Regulation (GDPR, EU 2016/679) and Latvian data protection law.
          </p>
          <p>
            Contact:{' '}
            <a
              href="mailto:info@secondturn.games"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              info@secondturn.games
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Data we collect
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Account data:</strong> email address, display name, country, phone number
            </li>
            <li>
              <strong>Listing data:</strong> game details, condition, photos, pricing. Location
              metadata (EXIF) is automatically stripped from uploaded photos
            </li>
            <li>
              <strong>Order data:</strong> purchase history, shipping addresses (parcel locker
              selections), order status
            </li>
            <li>
              <strong>Seller financial data:</strong> wallet balance, transaction history, bank
              account details (IBAN) for withdrawals
            </li>
            <li>
              <strong>Payment data:</strong> processed by EveryPay (Swedbank). We do not store card
              details
            </li>
            <li>
              <strong>Usage data:</strong> pages visited, browser type, IP address (for security and
              to improve the platform)
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Legal basis for processing
          </h2>
          <p>
            We process personal data under the following GDPR Article 6(1) legal bases:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Data category
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Legal basis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Account data</td>
                  <td className="py-2">Art. 6(1)(b) &mdash; contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Listing and order data</td>
                  <td className="py-2">Art. 6(1)(b) &mdash; contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Transaction records</td>
                  <td className="py-2">
                    Art. 6(1)(b) &mdash; contract + Art. 6(1)(c) &mdash; legal obligation
                    (tax/accounting)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Seller financial data</td>
                  <td className="py-2">
                    Art. 6(1)(b) &mdash; contract + Art. 6(1)(c) &mdash; legal obligation
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Usage and security data</td>
                  <td className="py-2">Art. 6(1)(f) &mdash; legitimate interest (security, fraud prevention)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            4. How we use your data
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and operate the marketplace</li>
            <li>To process transactions and arrange shipping</li>
            <li>To send transactional emails (order confirmations, shipping updates)</li>
            <li>To prevent fraud and enforce our terms of service</li>
            <li>To improve our platform based on usage patterns</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            5. Data storage and security
          </h2>
          <p>
            Your data is stored in Supabase (cloud database, hosted in Stockholm, Sweden) with
            row-level security policies. Our application servers are in Helsinki, Finland. Data in
            transit is encrypted via TLS, data at rest via AES-256. Photos are stored in Supabase
            Storage with access controls.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            6. Data sharing
          </h2>
          <p>We share your data with these processors:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>EveryPay (Swedbank):</strong> payment processing &mdash; name, email,
              transaction data
            </li>
            <li>
              <strong>Unisend SIA:</strong> parcel locker shipping &mdash; names, phone numbers,
              terminal selections
            </li>
            <li>
              <strong>Resend:</strong> transactional email delivery &mdash; email address, name,
              order information
            </li>
            <li>
              <strong>Supabase:</strong> database and storage infrastructure &mdash; all account,
              listing, and order data
            </li>
            <li>
              <strong>Cloudflare:</strong> security, CDN, and bot protection &mdash; IP address,
              browser fingerprint
            </li>
            <li>
              <strong>Sentry:</strong> error monitoring &mdash; error details, browser info, IP
              address (used to diagnose and fix technical issues)
            </li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Cookies
          </h2>
          <p>
            We use essential cookies for authentication and session management. These are necessary
            for the platform to function and cannot be disabled. We do not use advertising or
            tracking cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Your rights under GDPR
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Access</strong> your personal data (Article 15)
            </li>
            <li>
              <strong>Rectify</strong> inaccurate data (Article 16)
            </li>
            <li>
              <strong>Erase</strong> your data, subject to legal retention requirements (Article 17)
            </li>
            <li>
              <strong>Port</strong> your data to another service in a machine-readable format
              (Article 20)
            </li>
            <li>
              <strong>Object</strong> to processing based on legitimate interest (Article 21)
            </li>
            <li>
              <strong>Restrict</strong> processing in certain circumstances (Article 18)
            </li>
          </ul>
          <p>
            We will respond to all rights requests within 30 days. To access, export, or delete your
            data, visit your{' '}
            <Link
              href="/account/settings"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              account settings
            </Link>
            . For other requests, contact us at{' '}
            <a
              href="mailto:info@secondturn.games"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            9. Data retention
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Data type
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Retention period
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Account data</td>
                  <td className="py-2">Until account deletion + 90 days</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Listing data</td>
                  <td className="py-2">Until listing or account deleted</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Transaction and order records</td>
                  <td className="py-2">7 years (tax and accounting law)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Security logs (IP, login activity)</td>
                  <td className="py-2">30 days</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            You may request deletion of your account at any time. Transaction records are exempt from
            erasure requests due to legal retention requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            10. Data breach notification
          </h2>
          <p>
            If a data breach poses a risk to your rights, we will notify the supervisory authority
            within 72 hours per GDPR Article 33. If the risk to you is high, we will notify you
            directly as well.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            11. Children&apos;s data
          </h2>
          <p>
            You must be at least 16 to use the platform and at least 18 to sell. If someone under 16
            has created an account, contact us and we will delete their data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            12. Supervisory authority
          </h2>
          <p>
            If you believe your data protection rights have been violated, you can lodge a complaint
            with the Latvian Data State Inspectorate (DVI) at{' '}
            <a
              href="https://www.dvi.gov.lv"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              dvi.gov.lv
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            13. Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. We will notify registered users of
            significant changes via email.
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
            href="/seller-terms"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
          >
            Seller Agreement
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
