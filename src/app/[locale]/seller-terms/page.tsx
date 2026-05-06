import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { SELLER_TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';
import { LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_VAT_NUMBER,
  LEGAL_ENTITY_BANK_NAME,
  PSP_TECHNICAL_PROVIDER_NAME,
  PSP_TECHNICAL_PROVIDER_REG_NUMBER,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Seller Agreement',
};

export default function SellerTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Seller Agreement
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: {SELLER_TERMS_VERSION_DISPLAY}
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
                You must be at least 18, live in Latvia, Lithuania, or Estonia, and sell from
                your personal board game collection. No businesses or resellers.
              </li>
              <li>
                When you list a game, you appoint {LEGAL_ENTITY_NAME} as your commercial
                agent to collect payment from the buyer and pay you out after delivery and
                the dispute window.
              </li>
              <li>
                We charge 10% commission on the item price (not shipping). Your earnings go
                into a wallet on the platform, which you withdraw to a bank account you own.
              </li>
              <li>
                You need to confirm or decline orders promptly, ship accepted orders on time
                using the Unisend code, package games securely, and describe condition
                honestly. Misrepresentation or repeated issues can lead to refunds,
                chargebacks, or loss of selling privileges.
              </li>
              <li>
                Once you cross 30 sales or €2,000 in a calendar year, we have to report your
                activity to the Latvian tax authority (DAC7). We&apos;ll ask for your tax data
                before you hit that line so the report is complete.
              </li>
              <li>
                We may delay payouts, freeze your wallet, or suspend your selling if we see
                fraud, counterfeit items, AML or sanctions issues, or serious rule breaches.
                You can appeal any such decision.
              </li>
              <li>
                You remain responsible for declaring your sales income and complying with any
                VAT or other tax obligations that apply to you.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            1. Relationship between you and STG
          </h2>
          <p>
            This Seller Agreement supplements the general{' '}
            <Link href="/terms" className="link-brand">
              Terms of Service
            </Link>{' '}
            and applies when you list games for sale on Second Turn Games. In case of
            conflict, this Seller Agreement governs issues specific to selling.
          </p>
          <p>
            By creating a listing or enabling selling features, you appoint{' '}
            {LEGAL_ENTITY_NAME} as your commercial agent for the purpose of receiving
            payments from buyers and paying you the resulting proceeds, as described in this
            Agreement. We act in your name and on your behalf when collecting buyer funds and
            issuing refunds where a dispute is resolved against you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            2. Eligibility and private-sellers-only rule
          </h2>
          <p>
            To sell on Second Turn Games you need to be 18 or older and living in Latvia,
            Lithuania, or Estonia. By listing items, you confirm that you meet these
            requirements.
          </p>
          <p>
            This platform is for private individuals selling off their own board game
            collections. You can&apos;t list here in the course of a business, trade, or
            profession &mdash; that includes retailers, resellers, distributors, wholesalers,
            and auction houses. You also cannot list items you bought primarily to resell at
            a profit.
          </p>
          <p>
            If we have reason to think you are acting as a trader, we may ask you to confirm
            the private nature of your activity and provide additional information. We can
            suspend or close your account, or restrict your selling privileges, if you do not
            cooperate or if we reasonably conclude that you are running a business through
            the platform.
          </p>
          <p>
            If you come to think you are or have become a trader for the purposes of Directive
            2011/83/EU (the Consumer Rights Directive), tell us right away at{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            , stop creating new listings, and complete any open orders with the trader
            obligations that Directive imposes on you &mdash; including the 14-day withdrawal
            right for your buyers.
          </p>
          <p>
            <strong>Verification of traders.</strong> If you use the platform in a professional
            or commercial capacity, EU law requires us to verify your identity and contact
            details before you can list items. This includes collecting and verifying your
            name, address, telephone number, and self-certification that you will only offer
            products that comply with applicable EU law. We may request supporting documents
            and may delay or refuse listings while verification is outstanding. We can suspend
            any seller who fails our verification checks or provides misleading information.
            This is the obligation Article 30 of Regulation (EU) 2022/2065 (the Digital
            Services Act) places on us as the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            3. Payment authorisation and flow
          </h2>
          <p>
            When you list an item, you authorise {LEGAL_ENTITY_NAME} to take payment from
            buyers on your behalf. Payments go through {LEGAL_ENTITY_BANK_NAME}, a Latvian
            credit institution acting as our payment service provider. The technical platform
            is operated on Swedbank&apos;s behalf by {PSP_TECHNICAL_PROVIDER_NAME}{' '}
            (registered in Estonia, reg. {PSP_TECHNICAL_PROVIDER_REG_NUMBER}).
          </p>
          <p>
            Buyer funds sit in a marketplace account and are released to you only once
            delivery is confirmed and the dispute window has closed, or otherwise when a
            transaction is completed under our dispute rules.
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            4. Operational requirements when selling
          </h2>
          <p>When an order is placed for your listing, you must:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Confirm or decline the order within the time shown on the order screen. Orders
              not confirmed in time are automatically cancelled with a full refund to the
              buyer.
            </li>
            <li>
              Ship the item within the required shipping window after you accept the order.
              Orders not shipped in time may be automatically cancelled and the buyer
              refunded.
            </li>
            <li>
              Use the provided Unisend shipping code for all deliveries so that tracking and
              dispute resolution work correctly.
            </li>
            <li>
              Package items securely, using adequate protection for boxes, components, and
              manuals. You are liable for transit damage caused by poor packaging.
            </li>
            <li>
              Describe items accurately, including condition, edition, language, and any
              defects such as missing pieces or damaged components. Misleading descriptions
              may lead to disputes, refunds, or suspension of your selling privileges.
            </li>
          </ul>
          <p className="text-xs text-semantic-text-muted">
            For practical examples and current operational timelines, see our{' '}
            <Link href="/help" className="link-brand">
              Help Center
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Auction listings</h3>
          <p>If you list a game as an auction, the rules above apply plus these:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              You can withdraw an auction listing only while it has no bids. Once any bid has
              been placed, you must honour the auction and sell to the highest bidder at
              close.
            </li>
            <li>
              If the winning bidder does not pay within the stated payment window, the
              platform may cancel the listing and return the game to your inventory. No order
              is created until payment succeeds.
            </li>
          </ul>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Matches with wanted listings</h3>
          <p>
            If a game you list matches an active wanted listing from a buyer, that buyer may
            receive a notification. You have no visibility into wanted listings and no
            special obligations as a result of the match. The standard rules above apply to
            the sale like any other listing.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            5. Fees and commissions
          </h2>
          <p>
            STG charges a flat 10% commission on the item price. The commission does not
            apply to shipping costs. There are no listing fees.
          </p>
          <p>
            For example, if you list an item for &euro;20.00, the commission is &euro;2.00
            and you receive &euro;18.00. The buyer pays the item price plus shipping
            separately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            6. Wallet and payouts
          </h2>
          <p>
            Your earnings (item price minus 10% commission) are credited to your platform
            wallet after the order is completed. An order is considered completed when the
            buyer confirms delivery or the dispute window closes without a dispute being
            raised.
          </p>
          <p>
            You may withdraw your wallet balance to your own bank account (IBAN). Withdrawals
            are typically processed within 1&ndash;3 business days after approval, but bank
            processing times are outside our control.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Currency</h3>
          <p>All amounts in your wallet are held in Euro (EUR).</p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Identity verification</h3>
          <p>
            Before your first withdrawal, you may need to verify your identity and prove the
            IBAN belongs to you. This is the Know Your Customer check our payment processor
            runs. You may need to send a government-issued ID. We can decline or delay a
            withdrawal while verification is outstanding.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Chargebacks and clawback</h3>
          <p>
            If a buyer successfully disputes a completed order after you&apos;ve already
            withdrawn the money, you agree that (a) we can take the equivalent amount from
            your future wallet balance or sales proceeds, and (b) if your wallet doesn&apos;t
            cover it, you owe us the shortfall, and we may pursue it through the courts of
            your country of habitual residence.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Negative balance</h3>
          <p>
            If a refund, chargeback, or other adjustment pushes your wallet into the
            negative, you need to repay the shortfall within 30 days of notice, either by
            transfer to the bank account we name or by offset against future sales.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Inactive accounts</h3>
          <p>
            We hold wallet balances indefinitely. If you haven&apos;t logged in for 24 months
            and your balance is positive, we&apos;ll email the address on file. If we
            don&apos;t hear back within 90 days, we may try to send the balance to your last
            IBAN on file (after re-verification). Anything still unclaimed stays yours and
            we&apos;ll pay it out on request.
          </p>
        </section>

        <section id="suspension-and-risk-controls" className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            7. Suspension, termination, and risk controls
          </h2>
          <p>
            STG may suspend or terminate your selling privileges, or your account in whole,
            if we have reasonable grounds to believe you have:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>engaged in fraud or deceptive practices;</li>
            <li>
              repeatedly misrepresented item condition or details, or refused to resolve
              legitimate disputes;
            </li>
            <li>failed to ship accepted orders within the required timeframes;</li>
            <li>incurred excessive chargebacks or disputes;</li>
            <li>
              used the platform for commercial reselling in violation of Section 2; or
            </li>
            <li>otherwise harmed us or other users.</li>
          </ul>
          <p>
            On suspension or termination, pending payouts may be held for up to 180 days to
            cover chargebacks, refunds, or unresolved disputes.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>
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
            databases; (b) suspend your account, freeze your wallet balance, or refuse a
            payout if we have reasonable grounds to suspect money laundering, terrorist
            financing, sanctions evasion, or fraud; (c) ask you for more identification,
            source-of-funds information, or beneficial-ownership information; and (d) share
            information with competent authorities and with our payment processor. The named
            bodies that routinely receive such data are listed in &sect;6 of our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            . Funds frozen under this clause stay your property and are released once the
            matter is resolved, subject to any order from a competent authority.{' '}
            <strong>
              You may appeal any such action by writing to info@secondturn.games. A person
              who did not take the original decision will review the appeal within 14 days
              and respond in writing. Where AML, sanctions, or law-enforcement obligations
              prevent us from explaining a particular action, we will tell you when those
              obligations no longer prevent disclosure.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            8. Tax and invoicing
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>VAT on our commission</h3>
          <p>
            Our 10% commission on the item price is an electronically supplied service under
            Article 7 of Council Implementing Regulation (EU) No 282/2011. Place of supply is
            set by Article 58 of Directive 2006/112/EC (where the non-taxable-person customer
            is). VAT is included in the 10% commission shown on your invoice (not added on
            top), at the rate of your country: 21% for Latvia, 21% for Lithuania, 24% for
            Estonia. For a &euro;2.00 commission in Latvia, that&apos;s &euro;1.65 net plus
            &euro;0.35 VAT. Our VAT number is {LEGAL_ENTITY_VAT_NUMBER}.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>VAT on shipping</h3>
          <p>
            When we arrange shipping through our logistics partners, we re-supply the
            shipping to you at the VAT rate of the country the goods depart from (your
            country). VAT is included in the shipping fee shown on your invoice (not added
            on top). Place of supply is set by Articles 49 and 50 of Directive 2006/112/EC,
            depending on whether the shipment is domestic or cross-border.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Invoices</h3>
          <p>
            We issue an invoice for commission and shipping VAT after each completed order,
            in the format <span className="font-mono">INV-YYYY-NNNNN</span>. Invoices are
            available under &ldquo;Sales&rdquo; in your account and are kept for the
            periods in our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            {' '}§9.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Your income tax</h3>
          <p>
            You&apos;re responsible for declaring sales income to the tax authority in your
            country, subject to any private-seller thresholds that apply there. We don&apos;t
            withhold income tax for you and we don&apos;t give tax advice.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>DAC7 reporting</h3>
          <p>
            Under Council Directive (EU) 2021/514 (DAC7), we have to report you to the
            Latvian State Revenue Service (VID) once your activity in a calendar year passes
            30 sales or €2,000 in consideration (the amount you receive after our
            commission). These thresholds come from the Directive; we cannot adjust them.
            Before you hit them, we&apos;ll ask you for the DAC7 data so the report
            doesn&apos;t get held up. Our internal warning trigger is earlier, at 25 sales or
            €1,750. We ask for your full legal name, date of birth, address, and
            tax identification number. If you don&apos;t give us those, we may need to pause
            your selling and hold payouts until you do. You can ask for a copy of what we
            report about you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            9. Changes to this Agreement
          </h2>
          <p>
            We may update this Agreement. For material changes (fees, commission rates,
            seller obligations) we will email you at least 14 days before they take effect.
            Continued selling after the notice period means you accept the updated terms.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link href="/terms" className="link-brand">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="link-brand">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
