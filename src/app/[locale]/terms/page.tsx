import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Terms of Service
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: {TERMS_VERSION_DISPLAY}
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Quick Start
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              The plain-English version. For the full rulebook, read on.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                We&apos;re a marketplace for pre-loved board games in Latvia, Lithuania, and
                Estonia. We never sell anything ourselves — the sellers are other gamers.
              </li>
              <li>
                You need to be at least 16 to buy, and at least 18 and a private individual to
                sell. No businesses disguised as private sellers.
              </li>
              <li>
                Sellers describe their games honestly and ship them on time. We handle payments
                through EveryPay and shipping through Unisend.
              </li>
              <li>
                We charge sellers 10% commission on the item price only. Buyers just pay the
                game price plus shipping — no hidden fees, no service charge.
              </li>
              <li>
                If an order goes wrong, we mediate disputes and can refund you from the funds we
                hold on the seller&apos;s behalf.
              </li>
              <li>
                Because you&apos;re buying from a private individual, the usual 14-day EU right
                of withdrawal doesn&apos;t apply. Our dispute process is your safety net.
              </li>
              <li>
                You can delete your account anytime. See the Privacy Policy for what we keep, why,
                and for how long.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. About Second Turn Games
          </h2>
          <p>
            {LEGAL_ENTITY_NAME} (&ldquo;STG&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;),
            registration number {LEGAL_ENTITY_REG_NUMBER}, registered at {LEGAL_ENTITY_ADDRESS},
            operates a peer-to-peer marketplace for pre-loved board games in Latvia, Lithuania,
            and Estonia. We connect private buyers and private sellers; the sale contract is
            concluded directly between them.
          </p>
          <p>
            Payments are processed through EveryPay (Maksekeskus AS), a licensed Estonian
            payment institution. Funds received from buyers are held in an account designated
            for marketplace transactions and are released to sellers after the order is
            confirmed delivered and the dispute window has closed. Second Turn Games is not
            itself a payment institution and does not hold a payment services licence. We
            refer to our role in the flow as that of a commercial agent acting on behalf of
            sellers, and we rely on the exemption in Article 3(b) of Directive (EU) 2015/2366
            (PSD2). If that exemption is determined not to apply in any particular case, we
            will restructure the flow through a licensed payment institution.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Eligibility
          </h2>
          <p>
            You must be at least 16 years old and reside in Latvia, Lithuania, or Estonia to use our
            platform. By creating an account, you confirm that you meet these requirements. You must be
            at least 18 years old to list items for sale.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Consumer protection notice
          </h2>
          <p>
            All sellers on Second Turn Games are private individuals selling personal items, not
            businesses or professional traders. EU consumer protection rules that apply to
            business-to-consumer sales (the 14-day withdrawal right, the 2-year legal guarantee of
            conformity) do not apply to transactions on this platform.
          </p>
          <p>
            What we do instead: buyer payments are held until delivery is confirmed, and buyers have
            2 days after delivery to report issues with their order.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            4. Buyer obligations
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pay the listed item price plus shipping costs at checkout</li>
            <li>Provide accurate shipping information (parcel locker selection)</li>
            <li>Confirm delivery once you have received and inspected the item</li>
            <li>
              Raise any disputes within 2 days of delivery. Issues reported after the dispute window
              closes cannot be considered for a refund
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            5. Seller obligations
          </h2>
          <p>
            Sellers have additional obligations under our{' '}
            <Link
              href="/seller-terms"
              className="link-brand"
            >
              Seller Agreement
            </Link>
            . By creating a listing, you confirm that you are at least 18 years old and agree to
            those terms. The key ones:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>List items accurately, including condition, edition, and language</li>
            <li>Confirm or decline orders within 48 hours</li>
            <li>Ship items within 5 days of accepting the order using the provided Unisend shipping code</li>
            <li>Package items securely. Sellers are liable for damage during transit</li>
            <li>Respond to buyer inquiries and disputes in good faith</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            6. Fees and commissions
          </h2>
          <p>
            Buyers pay the item price plus shipping. There is no service fee for buyers.
          </p>
          <p>
            Sellers are charged a 10% commission on the item price (not on shipping costs).
            Seller earnings (90% of item price) are credited to their platform wallet after order
            completion. There are no listing fees.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Payments
          </h2>
          <p>
            Payments are processed through EveryPay (Swedbank). Orders are only created after
            payment is confirmed. STG does not store card details. Buyer funds are held by the
            platform until the order is completed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Shipping
          </h2>
          <p>
            All shipments go through the Unisend parcel locker network, which includes Unisend,
            Latvijas Pasts, and uDrop terminals across Latvia, Lithuania, and Estonia. Cross-border
            shipping between Baltic states is supported. A shipping code is generated automatically
            after the seller accepts an order.
          </p>
        </section>

        <section id="cancellations-refunds" className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            9. Cancellations, refunds, and disputes
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Order cancellations
          </h3>
          <p>
            A seller may decline an order within 48 hours. If a seller does not respond within
            48 hours, or does not ship within 5 days of accepting, the order is cancelled
            automatically. In both cases you get a full refund. Buyers cannot cancel after
            payment &mdash; orders are binding once paid.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Returns and replacements
          </h3>
          <p>
            Returns and replacements are not available. All sellers are private individuals
            selling personal items, not retailers, so the 14-day EU withdrawal right does not
            apply (see Section 3). Each listed item is one of a kind, so we cannot offer
            replacements. If an item arrives damaged or does not match its description, you may
            open a dispute (see below).
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Refunds
          </h3>
          <p>
            You receive a refund when a seller cancels or declines an order, when an order is
            auto-cancelled due to a timeout, or when a dispute is resolved in your favour.
            &ldquo;Changed mind&rdquo; is not grounds for a refund. Refunds go back to the
            original payment method. Card refunds typically take 3&ndash;5 business days. If you
            paid partly with wallet balance, each portion is refunded to its source (card to card,
            wallet to wallet).
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Disputes
          </h3>
          <p>
            You have 2 days after delivery to open a dispute if an item arrives damaged, is the
            wrong item, or does not match its listing description. If an item is not delivered
            within 21 days of shipping, the platform opens a dispute on your behalf. Once a
            dispute is opened, seller and buyer have 7 days to negotiate. If no agreement is
            reached, either party may escalate to STG staff for review.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            10. Prohibited content
          </h2>
          <p>
            Listings must be for board games only. Counterfeit items, stolen goods, and items that
            violate intellectual property rights are strictly prohibited. STG reserves the right to
            remove any listing or suspend any account that violates these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            11. User content
          </h2>
          <p>
            By posting listings, photos, descriptions, or comments on the platform, you grant STG a
            non-exclusive, royalty-free license to display, reproduce, and distribute that content on
            the platform for the purpose of operating the marketplace. You retain ownership of your
            content and may remove it at any time by deleting the associated listing or account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            12. Ending your account or our services
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            You ending your account
          </h3>
          <p>
            You may close your account at any time from your account settings. Closure is
            immediate. Before your account can be closed, you must (a) cancel or complete any
            active listings and in-progress orders, (b) withdraw any positive wallet balance,
            and (c) resolve any pending disputes. On closure, we anonymise your profile, your
            public comments, and your order messages so that they no longer identify you; we
            cancel any residual listings; we remove your listing photos from storage within
            6 hours; and we delete your account in our authentication system. Information we
            are required by law to retain (completed-order records, invoices, DAC7 reporting
            data, and security logs) is retained for the periods set out in Section 9 of our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            , in a form that does not link to your anonymised account except where the retention
            obligation requires it.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Us ending your account
          </h3>
          <p>
            We may suspend or terminate your account, remove listings, or freeze your wallet
            balance if we have reasonable grounds to believe you have (a) breached these Terms
            or the Seller Agreement, (b) engaged in fraud, misrepresentation, or commercial
            reselling, (c) failed to ship or respond to orders repeatedly, (d) accumulated
            excessive chargebacks, (e) triggered our anti-money-laundering, sanctions, or
            fraud controls, or (f) caused us or another user harm. Where we take such action,
            we notify you of the reasons and of your right to dispute the decision, in
            accordance with Article 17 of Regulation (EU) 2022/2065 (the Digital Services Act).
            Where your account is terminated for cause, any positive wallet balance is payable
            to you after deduction of any amounts you owe us, and may be held for up to
            180 days to cover potential chargebacks or claims before being released.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Effect of termination
          </h3>
          <p>
            Termination does not affect any rights or obligations that have accrued up to the
            date of termination. The clauses on liability (Section 13), governing law and
            jurisdiction (Section 14), and reporting obligations under applicable tax law
            survive termination indefinitely.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            13. Limitation of liability
          </h2>
          <p>
            The platform is provided &ldquo;as is&rdquo; without warranties of any kind. STG
            connects buyers and sellers but is not a party to the sale itself. We do not guarantee
            the condition, authenticity, or quality of listed items.
          </p>
          <p>
            To the maximum extent permitted by applicable law, our total liability to you in
            connection with the platform or these Terms is limited to the greater of (a)
            &euro;500 and (b) the fees and commissions paid by you in the twelve months
            preceding the event giving rise to the claim.
          </p>
          <p>The following are not limited or excluded:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>liability for death or personal injury caused by our negligence,</li>
            <li>liability for fraud or fraudulent misrepresentation,</li>
            <li>
              any liability that cannot lawfully be limited or excluded under the consumer
              protection law of your country of habitual residence, and
            </li>
            <li>
              any statutory liability we have as an intermediary service provider under
              Regulation (EU) 2022/2065 or equivalent national law.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            14. Governing law and disputes
          </h2>
          <p>
            These Terms are governed by the laws of the Republic of Latvia. The courts of Riga,
            Latvia, have jurisdiction over disputes arising from these Terms or use of the
            platform, without prejudice to (a) the mandatory consumer protection rules of your
            country of habitual residence under Article 6 of Regulation (EC) 593/2008, and
            (b) your right as a consumer to bring proceedings in the courts of your country of
            habitual residence under Article 18 of Regulation (EU) 1215/2012.
          </p>
          <p>
            If you have a complaint, please contact us first at{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . If we cannot resolve it between us, you can take the complaint to the consumer
            protection authority in your country of residence:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Latvia:</strong> Consumer Rights Protection Centre (Patērētāju tiesību
              aizsardzības centrs &mdash; PTAC), Brīvības 55, Riga, LV-1010 &mdash;{' '}
              <a
                href="https://www.ptac.gov.lv"
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                ptac.gov.lv
              </a>
            </li>
            <li>
              <strong>Lithuania:</strong> State Consumer Rights Protection Authority (Valstybinė
              vartotojų teisių apsaugos tarnyba) &mdash;{' '}
              <a
                href="https://vvtat.lrv.lt"
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                vvtat.lrv.lt
              </a>
            </li>
            <li>
              <strong>Estonia:</strong> Consumer Protection and Technical Regulatory Authority
              (Tarbijakaitse ja Tehnilise Järelevalve Amet &mdash; TTJA) &mdash;{' '}
              <a
                href="https://www.ttja.ee"
                className="link-brand"
                target="_blank"
                rel="noopener noreferrer"
              >
                ttja.ee
              </a>
            </li>
          </ul>
          <p className="text-xs text-semantic-text-muted">
            The EU Online Dispute Resolution platform was discontinued on 20 July 2025 under
            Regulation (EU) 2024/3228 and is no longer available.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading pt-1">
            Trader-status disputes
          </h3>
          <p>
            If a dispute between a buyer and a seller concerns whether the seller is a trader
            within the meaning of Directive 2011/83/EU, we will (a) review the seller&apos;s
            activity against our internal criteria, (b) provide the buyer with the outcome of
            our review, and (c) where we conclude the seller is likely a trader, support the
            buyer in exercising their statutory rights, including facilitating a refund where a
            withdrawal right would apply. Our review does not bind the courts or consumer
            protection authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            15. Changes to these terms
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the platform after changes
            constitutes acceptance of the updated terms. We will notify registered users of
            significant changes via email.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            16. Contact
          </h2>
          <p>
            Questions about these terms? Reach us at{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            or visit our{' '}
            <Link href="/contact" className="link-brand">
              contact page
            </Link>
            .
          </p>
          <p>
            <strong>Single point of contact under the Digital Services Act.</strong>{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            is also our designated electronic single point of contact for communications with
            users under Article 12 of Regulation (EU) 2022/2065 (the Digital Services Act). Use
            this address to reach us directly in any language spoken by our users (English,
            Latvian, Lithuanian, or Estonian) on any DSA-related matter.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link
            href="/privacy"
            className="link-brand"
          >
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            href="/seller-terms"
            className="link-brand"
          >
            Seller Agreement
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
