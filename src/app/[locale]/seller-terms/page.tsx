import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { SELLER_TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';
import { LEGAL_ENTITY_NAME, LEGAL_ENTITY_VAT_NUMBER } from '@/lib/constants';

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
          Last updated: {SELLER_TERMS_VERSION_DISPLAY}
        </p>

        <p>
          This Seller Agreement supplements the general{' '}
          <Link
            href="/terms"
            className="link-brand"
          >
            Terms of Service
          </Link>
          . By creating a listing on Second Turn Games, you agree to these additional terms.
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Quick Start
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              The plain-English version for sellers. For the full rulebook, read on.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                You must be at least 18 and a private individual living in Latvia, Lithuania, or
                Estonia. No business-like reselling operations.
              </li>
              <li>
                Describe your games accurately, pack them well, and ship on time. If a buyer
                receives something noticeably worse than the listing, they can claim a refund.
              </li>
              <li>
                We charge 10% commission on the item price (not shipping). Your earnings land in
                a platform wallet; you withdraw them to a bank account you own.
              </li>
              <li>
                Once you cross 30 sales or €2,000 in a calendar year, we&apos;re required to
                report you to the tax authority under DAC7. We&apos;ll ask for your tax details
                before you hit that line, not after.
              </li>
              <li>
                We can delay payouts, reverse transactions, or suspend your account if fraud,
                counterfeit items, or false descriptions come up.
              </li>
              <li>
                You remain responsible for your own income-tax obligations — being a private
                seller doesn&apos;t mean your sales are automatically tax-free.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. Eligibility and private-sellers-only rule
          </h2>
          <p>
            To sell on Second Turn Games you must be at least 18 years old and reside in Latvia,
            Lithuania, or Estonia.
          </p>
          <p>
            Second Turn Games is a platform for private individuals selling their personal board
            game collections. You may not list items on the platform in the course of a business,
            trade, or profession, including as a retailer, reseller, distributor, wholesaler, or
            auction house. You must not list items that you acquired primarily for resale. We
            may, at our discretion and without notice, require you to confirm the private nature
            of your activity and may suspend or terminate your account if we have reasonable
            grounds to believe you are acting as a trader.
          </p>
          <p>
            If you believe you are or have become a trader for the purposes of Directive
            2011/83/EU (the Consumer Rights Directive), you must notify us immediately at{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            , cease new listings, and complete any outstanding orders in accordance with the
            trader obligations in that Directive (including the 14-day withdrawal right for
            buyers).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Payment authorization
          </h2>
          <p>
            By listing an item on Second Turn Games, you authorise {LEGAL_ENTITY_NAME} to
            receive payments from buyers on your behalf. Payments are processed through
            EveryPay (Maksekeskus AS), a licensed Estonian payment institution. Funds are held
            in an account designated for marketplace transactions and released to you after
            the order is confirmed delivered and the dispute window has closed.
          </p>
          <p>
            {LEGAL_ENTITY_NAME} is not itself a payment institution and does not hold a payment
            services licence. We refer to our role in this flow as that of a commercial agent
            acting on your behalf, and we rely on the exemption in Article 3(b) of Directive
            (EU) 2015/2366 (PSD2). If that exemption is determined not to apply in any
            particular case, we will restructure the flow through a licensed payment
            institution.
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

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Currency
          </h3>
          <p>All amounts in your wallet are held in Euro (EUR).</p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Identity verification
          </h3>
          <p>
            Before your first withdrawal, you may be required to verify your identity and the
            ownership of the IBAN to which you are withdrawing, in accordance with the Know
            Your Customer requirements of our payment processor. Verification may require a
            government-issued identity document. We may decline or delay withdrawals pending
            successful verification.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Chargebacks and clawback
          </h3>
          <p>
            If a buyer successfully disputes a completed order after you have withdrawn the
            associated funds, you agree that (a) we may retain an equivalent amount from your
            future wallet balance and from any subsequent sales proceeds, and (b) if your wallet
            balance is insufficient, you remain liable for the shortfall and we may pursue the
            amount through the courts of your country of habitual residence.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Negative balance
          </h3>
          <p>
            If a refund, chargeback, or other adjustment results in your wallet balance being
            negative, you must repay the shortfall within 30 days of notice, either by transfer
            to the bank account we designate or by offset against future sales proceeds.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Inactive accounts
          </h3>
          <p>
            Wallet balances are retained indefinitely. If you have not logged into your account
            for 24 months and your wallet balance is positive, we will attempt to contact you at
            your registered email address. If you do not respond within 90 days of such contact,
            we may withdraw the balance to the last IBAN we have on file for you, subject to
            successful re-verification. Unclaimed amounts remain your property and will be paid
            on request.
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

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Anti-money-laundering, sanctions, and fraud
          </h3>
          <p>
            We reserve the right, at our discretion and without prior notice, to (a) screen
            transactions, accounts, IBANs, and identifying information against EU and
            international sanctions lists, politically exposed person lists, and fraud databases;
            (b) suspend your account, freeze your wallet balance, or refuse a payout if we have
            reasonable grounds to suspect money laundering, terrorist financing, sanctions
            evasion, or fraud; (c) request additional identification, source-of-funds, or
            beneficial-ownership information; and (d) share information with competent
            authorities, including the Latvian State Security Service, the Financial
            Intelligence Unit (FID), the State Revenue Service (VID), and our payment processor.
            Funds frozen under this provision remain your property and will be released once the
            matter is resolved, subject to any order of a competent authority.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Tax and invoicing
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            VAT on our commission
          </h3>
          <p>
            Our 10% commission on the item price is an electronically supplied service within the
            meaning of Article 7 of Council Implementing Regulation (EU) No 282/2011. Place of
            supply is determined under Article 58 of Directive 2006/112/EC (place of the non-
            taxable-person customer). VAT is added on top of the commission amount (not
            included), at the rate of your country of residence: 21% for Latvia, 21% for
            Lithuania, 24% for Estonia. Our VAT number is {LEGAL_ENTITY_VAT_NUMBER}.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            VAT on shipping
          </h3>
          <p>
            When we arrange shipping through our logistics partners on your behalf, we re-supply
            the shipping service to you at the VAT rate of the country where the goods depart
            (your country). Place of supply is determined under Articles 49 and 50 of Directive
            2006/112/EC, depending on whether the shipment is domestic or cross-border.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Invoices
          </h3>
          <p>
            We issue an invoice for commission and shipping VAT after each completed order in
            the format <span className="font-mono">INV-YYYY-NNNNN</span>. Invoices are available
            under &ldquo;My sales&rdquo; in your account and are retained for the periods set
            out in our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            {' '}§9.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Your income tax
          </h3>
          <p>
            You are responsible for declaring income from sales on the platform to the tax
            authorities of your country of residence, subject to any applicable private-seller
            thresholds. We do not withhold income tax on your behalf and do not provide tax
            advice.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            DAC7 reporting
          </h3>
          <p>
            Under Council Directive (EU) 2021/514 (DAC7), we are required to report to the
            Latvian State Revenue Service (VID) once you exceed 30 sales or €2,000 in a
            calendar year. We may ask you to provide DAC7 data as you approach this threshold
            (our internal warning trigger is 25 sales or €1,750) so that reporting is not held
            up when the statutory threshold is reached. We ask for your full legal name, date
            of birth, address, and tax identification number. If you do not provide this
            information, we may have to suspend your selling privileges and withhold payouts
            until the obligation is resolved. A copy of what we report about you is available
            on request.
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
            className="link-brand"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="link-brand"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
