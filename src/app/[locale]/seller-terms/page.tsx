import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { SELLER_TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';
import { LEGAL_ENTITY_NAME, LEGAL_ENTITY_VAT_NUMBER } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Seller Agreement',
};

const subHeadingClass = 'text-base font-semibold text-semantic-text-heading pt-1';

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
            To sell on Second Turn Games you need to be 18 or older and living in Latvia,
            Lithuania, or Estonia.
          </p>
          <p>
            This platform is for private individuals selling off their own board game
            collections. You can&apos;t list here in the course of a business, trade, or
            profession — that includes retailers, resellers, distributors, wholesalers, and
            auction houses. You can&apos;t list items you bought to resell at a profit. If we
            have reason to think you&apos;re acting as a trader, we can ask you to confirm the
            private nature of your activity and, if needed, suspend or close your account.
          </p>
          <p>
            If you come to think you are or have become a trader for the purposes of Directive
            2011/83/EU (the Consumer Rights Directive), tell us right away at{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            , stop new listings, and complete any open orders with the trader obligations that
            Directive imposes on you — including the 14-day withdrawal right for your buyers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Payment authorization
          </h2>
          <p>
            When you list an item, you authorise {LEGAL_ENTITY_NAME} to take payment from
            buyers on your behalf. Payments go through EveryPay (Maksekeskus AS), a licensed
            Estonian payment institution. The funds sit in a marketplace account and are
            released to you once delivery is confirmed and the dispute window has closed.
          </p>
          <p>
            We are not a payment institution ourselves and do not hold a payment services
            licence. Our role in this flow is that of a commercial agent acting for you, and
            we rely on the exemption in Article 3(b) of Directive (EU) 2015/2366 (PSD2). If
            that exemption turns out not to apply, we will move the flow to a licensed
            payment institution.
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

          <h3 className={subHeadingClass}>
            Auction listings
          </h3>
          <p>
            If you list a game as an auction, the rules above apply plus these:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              You can withdraw an auction listing while it has no bids. Once any
              bid has been placed, you cannot withdraw the listing and you must
              honour the winning bid at close. We do not make exceptions for
              damage, loss, or change of mind.
            </li>
            <li>
              If the winning bidder does not pay within 24 hours of the auction
              closing, the platform cancels the listing and the game returns to
              your inventory. Orders are only created once payment succeeds, so
              this cancellation is ours to make, not yours &mdash; you are free to
              re-list the game.
            </li>
          </ul>

          <h3 className={subHeadingClass}>
            Matches with wanted listings
          </h3>
          <p>
            If a game you list matches an active wanted listing from a buyer, that
            buyer gets a notification. You have no visibility into wanted listings
            and no special obligations as a result of the match &mdash; the
            standard rules above apply to the sale like any other.
          </p>
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

          <h3 className={subHeadingClass}>
            Currency
          </h3>
          <p>All amounts in your wallet are held in Euro (EUR).</p>

          <h3 className={subHeadingClass}>
            Identity verification
          </h3>
          <p>
            Before your first withdrawal, you may need to verify your identity and prove the
            IBAN belongs to you — this is the Know Your Customer check our payment processor
            runs. You may need to send a government-issued ID. We can decline or delay a
            withdrawal while verification is outstanding.
          </p>

          <h3 className={subHeadingClass}>
            Chargebacks and clawback
          </h3>
          <p>
            If a buyer successfully disputes a completed order after you&apos;ve already
            withdrawn the money, you agree that (a) we can take the equivalent amount from
            your future wallet balance or sales proceeds, and (b) if your wallet doesn&apos;t
            cover it, you owe us the shortfall — and we may pursue it through the courts of
            your country of habitual residence.
          </p>

          <h3 className={subHeadingClass}>
            Negative balance
          </h3>
          <p>
            If a refund, chargeback, or other adjustment pushes your wallet into the negative,
            you need to repay the shortfall within 30 days of notice — either by transfer to
            the bank account we name, or by offset against future sales.
          </p>

          <h3 className={subHeadingClass}>
            Inactive accounts
          </h3>
          <p>
            We hold wallet balances indefinitely. If you haven&apos;t logged in for 24 months
            and your balance is positive, we&apos;ll email the address on file. If we
            don&apos;t hear back within 90 days, we may try to send the balance to your last
            IBAN on file (after re-verification). Anything still unclaimed stays yours and
            we&apos;ll pay it out on request.
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

          <h3 className={subHeadingClass}>
            Anti-money-laundering, sanctions, and fraud
          </h3>
          <p>
            <strong>
              On reasonable grounds, with notice as soon as legally permitted (notice may be
              delayed where required by AML, sanctions, or law-enforcement obligations), we
              may
            </strong>{' '}
            (a) screen transactions, accounts, IBANs, and identifying information against EU
            and international sanctions lists, politically exposed person lists, and fraud
            databases; (b) suspend your account, freeze your wallet balance, or refuse a payout
            if we have reasonable grounds to suspect money laundering, terrorist financing,
            sanctions evasion, or fraud; (c) ask you for more identification, source-of-funds
            information, or beneficial-ownership information; and (d) share information with
            competent authorities — including the Latvian State Security Service, the
            Financial Intelligence Unit (FID), the State Revenue Service (VID), and our
            payment processor. Funds frozen under this clause stay your property and are
            released once the matter is resolved, subject to any order from a competent
            authority.{' '}
            <strong>
              You may appeal any such action by writing to info@secondturn.games. A person who
              did not take the original decision will review the appeal within 14 days and
              respond in writing. Where AML, sanctions, or law-enforcement obligations
              prevent us from explaining a particular action, we will tell you when those
              obligations no longer prevent disclosure.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Tax and invoicing
          </h2>

          <h3 className={subHeadingClass}>
            VAT on our commission
          </h3>
          <p>
            Our 10% commission on the item price is an electronically supplied service under
            Article 7 of Council Implementing Regulation (EU) No 282/2011. Place of supply is
            set by Article 58 of Directive 2006/112/EC (where the non-taxable-person customer
            is). VAT is added on top of the commission (not included), at the rate of your
            country: 21% for Latvia, 21% for Lithuania, 24% for Estonia. Our VAT number is{' '}
            {LEGAL_ENTITY_VAT_NUMBER}.
          </p>

          <h3 className={subHeadingClass}>
            VAT on shipping
          </h3>
          <p>
            When we arrange shipping through our logistics partners, we re-supply the shipping
            to you at the VAT rate of the country the goods depart from (your country). Place
            of supply is set by Articles 49 and 50 of Directive 2006/112/EC, depending on
            whether the shipment is domestic or cross-border.
          </p>

          <h3 className={subHeadingClass}>
            Invoices
          </h3>
          <p>
            We issue an invoice for commission and shipping VAT after each completed order,
            in the format <span className="font-mono">INV-YYYY-NNNNN</span>. Invoices are
            available under &ldquo;My sales&rdquo; in your account and are kept for the
            periods in our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            {' '}§9.
          </p>

          <h3 className={subHeadingClass}>
            Your income tax
          </h3>
          <p>
            You&apos;re responsible for declaring sales income to the tax authority in your
            country, subject to any private-seller thresholds that apply there. We don&apos;t
            withhold income tax for you and we don&apos;t give tax advice.
          </p>

          <h3 className={subHeadingClass}>
            DAC7 reporting
          </h3>
          <p>
            Under Council Directive (EU) 2021/514 (DAC7), we have to report you to the
            Latvian State Revenue Service (VID) once your activity in a calendar year
            passes 30 sales or €2,000 in consideration (the amount you receive after
            our commission). These thresholds come from the Directive; we cannot
            adjust them. Before you hit them, we&apos;ll
            ask you for the DAC7 data so the report doesn&apos;t get held up &mdash;
            our internal warning trigger is earlier, at 25 sales or €1,750. We ask for
            your full legal name, date of birth, address, and tax identification
            number. If you don&apos;t give us those, we may need to pause your selling
            and hold payouts until you do. You can ask for a copy of what we report
            about you.
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

        <div className="pt-4 border-t border-semantic-border-subtle space-y-3">
          <p className="text-xs text-semantic-text-muted">
            <strong>Version 2026-04-28</strong> — the AML/sanctions clause now requires
            reasonable grounds and gives notice as soon as legally permitted (silent only
            while AML, sanctions, or law-enforcement obligations require). If we act, you can
            appeal in writing and a reviewer who didn&rsquo;t take the original decision
            will respond within 14 days.
          </p>

          <p className="text-sm text-semantic-text-muted">
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
    </div>
  );
}
