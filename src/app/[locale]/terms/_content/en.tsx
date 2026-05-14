import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';
import { ADR_BODIES } from '@/lib/legal/adr-bodies';
import { LEGAL_SECTION_HEADING_CLASS, LEGAL_SUB_HEADING_CLASS } from '@/lib/legal/page-classes';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';

export default function TermsEn() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
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
                We run a peer-to-peer marketplace for pre-loved board games in Latvia,
                Lithuania, and Estonia. We never sell anything ourselves &mdash; the sellers
                are other gamers.
              </li>
              <li>
                You need to be at least 16 and live in Latvia, Lithuania, or Estonia to use
                the platform. You must be at least 18 and a private individual to sell.
              </li>
              <li>
                Because you are buying from private individuals, the usual 14-day EU
                withdrawal right and 2-year guarantee do not apply by default. Our dispute
                process and payment hold are your safety net.
              </li>
              <li>
                Buyers pay the item price plus shipping. We charge sellers a commission under
                the separate Seller Agreement.
              </li>
              <li>
                If an order goes wrong &mdash; damaged, not as described, or not delivered
                &mdash; you can open a dispute within a short window. We mediate and can
                refund you from the funds we hold on the seller&apos;s behalf.
              </li>
              <li>
                You can delete your account anytime from your settings. The Privacy Policy
                explains what we keep, why, and for how long.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            1. About Second Turn Games
          </h2>
          <p>
            {LEGAL_ENTITY_NAME}{' '}
            (&ldquo;STG&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), registration number{' '}
            {LEGAL_ENTITY_REG_NUMBER}, registered at {LEGAL_ENTITY_ADDRESS}, runs a
            peer-to-peer marketplace for pre-loved board games in Latvia, Lithuania, and
            Estonia. We connect private buyers and private sellers; the sale itself is a
            contract between them, not with us.
          </p>
          <p>
            We act as a commercial agent for sellers when handling payments. When a buyer pays
            for an order, we collect the funds on the seller&apos;s behalf and release them
            only after delivery and the dispute window have passed. The detailed terms of this
            seller relationship are set out in our{' '}
            <Link href="/seller-terms" className="link-brand">
              Seller Agreement
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            2. Eligibility and account
          </h2>
          <p>
            You must be at least 16 years old and reside in Latvia, Lithuania, or Estonia to
            use our platform. By creating an account, you confirm that you meet these
            requirements. You must be at least 18 years old to list items for sale or receive
            payouts.
          </p>
          <p>
            You are responsible for keeping your login details safe and for all activity under
            your account. If you suspect unauthorised access, let us know immediately at{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            3. Consumer protection notice
          </h2>
          <p>
            Everyone selling on Second Turn Games is a private individual with a personal
            collection, not a business or professional trader. The EU consumer-protection
            rules that apply to business-to-consumer sales &mdash; the 14-day withdrawal right
            and the 2-year guarantee of conformity &mdash; do not apply by default here.
          </p>
          <p>
            What you get instead: buyer funds are held until delivery, and buyers have a short
            period after delivery to open a dispute if something is wrong. Where a seller is
            in fact acting as a trader, your statutory consumer rights may apply; see Section
            14 (Trader-status disputes).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            4. Buyer obligations
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pay the listed item price plus shipping costs at checkout.</li>
            <li>
              Provide accurate delivery details (including the correct parcel locker).
            </li>
            <li>
              Inspect the item promptly after delivery and confirm delivery in your account.
            </li>
            <li>
              Raise any disputes within the dispute window described in Section 8. We cannot
              consider issues reported after that window closes.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            5. Selling on Second Turn Games
          </h2>
          <p>
            To sell on Second Turn Games you must be at least 18, live in Latvia, Lithuania,
            or Estonia, and act as a private individual selling from your own board game
            collection. You may not sell in the course of a business, trade, or profession.
          </p>
          <p>
            Sellers have additional obligations under our{' '}
            <Link href="/seller-terms" className="link-brand">
              Seller Agreement
            </Link>
            . By creating a listing, you confirm that you meet the eligibility rules above
            and agree to that agreement. In short, sellers must:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Describe items accurately, including condition, edition, and language.
            </li>
            <li>
              Confirm or decline orders within a short timeframe and ship accepted orders on
              time.
            </li>
            <li>
              Package items securely. Sellers are responsible for transit damage caused by
              poor packaging.
            </li>
            <li>
              Respond to buyer messages and disputes in good faith through the platform.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            6. Fees
          </h2>
          <p>
            Buyers pay the item price plus shipping. There is no separate service fee for
            buyers.
          </p>
          <p>
            Sellers pay a commission on successful sales and receive their earnings via a
            platform wallet, as described in the{' '}
            <Link href="/seller-terms" className="link-brand">
              Seller Agreement
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            7. Shipping
          </h2>
          <p>
            All shipments go through the Unisend parcel locker network, which includes
            Unisend, Latvijas Pasts, and uDrop terminals across Latvia, Lithuania, and
            Estonia. Cross-border shipping between Baltic states is supported.
          </p>
          <p>
            A shipping code is generated automatically after the seller accepts an order.
            Sellers must use the provided code for all deliveries so that we can track
            shipments and resolve disputes.
          </p>
        </section>

        <section id="cancellations-refunds" className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            8. Cancellations, refunds, and disputes
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Order cancellations</h3>
          <p>
            A seller may decline an order within a short acceptance window. If a seller does
            not respond or does not ship on time, the order may be cancelled automatically
            and the buyer refunded in full. Buyers cannot cancel after payment &mdash; orders
            are binding once paid.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Returns and replacements</h3>
          <p>
            Returns and replacements are not available as a standard option. All sellers are
            private individuals, and each listed item is one of a kind, so we cannot offer
            replacements. If an item arrives damaged or does not match its description, you
            may open a dispute as described below.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Refunds</h3>
          <p>
            You receive a refund when (a) a seller cancels or declines an order, (b) an
            order is auto-cancelled due to seller inaction, or (c) a dispute is resolved in
            your favour. Changed mind is not grounds for a refund. Refunds go back to the
            original payment method or wallet balance used.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Disputes</h3>
          <p>
            You have a short dispute window after delivery to tell us if an item arrives
            damaged, is the wrong item, or does not match its listing description. If an item
            is not delivered within a reasonable time after shipping, we may open a dispute
            on your behalf. During a dispute, buyer and seller should try to resolve the
            issue through the platform; if they cannot, either party may ask STG to review
            and decide.
          </p>
          <p className="text-xs text-semantic-text-muted">
            The current time limits for opening and resolving disputes are described in our{' '}
            <Link href="/help" className="link-brand">
              Help Center
            </Link>
            ; we may adjust those operational timelines over time without changing your core
            rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            9. Prohibited content and conduct
          </h2>
          <p>
            Listings must be for board games and closely related accessories only. Counterfeit
            items, stolen goods, and items that violate intellectual property or other rights
            are strictly prohibited.
          </p>
          <p>
            You may not use the platform to harass others, spread illegal content, or
            interfere with the security or operation of the service. We may remove content or
            suspend accounts that violate these rules.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            10. User content
          </h2>
          <p>
            By posting listings, photos, descriptions, or comments on the platform, you grant
            STG a non-exclusive, royalty-free licence to display, reproduce, and distribute
            that content on the platform for the purpose of operating the marketplace. You
            retain ownership of your content and may remove it by deleting the associated
            listing or account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            11. Marketplace features
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Listing questions</h3>
          <p>
            Each listing has a public comment thread where anyone can ask the seller about
            the game. Comments must stay on-topic and respectful. We may remove comments
            that violate these Terms or applicable law.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Auctions</h3>
          <p>
            Some listings may use an auction format. Bids are binding: if you place the
            winning bid, you are committing to buy at that price and must pay within the
            stated timeframe. Sellers who choose auction format must honour the winning bid
            once any bid has been placed. For the full auction rules, see our{' '}
            <Link href="/help" className="link-brand">
              Help Center
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Wanted listings</h3>
          <p>
            Wanted listings let you signal interest in a game. When a matching game is
            listed, we may notify you, but you are not reserving any item or committing to
            buy. Sellers are not bound to accept offers from wanted listings. Standard rules
            on orders and disputes apply only once you place an actual order.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            12. Ending your account or our services
          </h2>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>You ending your account</h3>
          <p>
            You can close your account at any time from your account settings. Before we can
            close it you need to cancel or complete any active listings and in-progress
            orders, withdraw any positive wallet balance, and resolve any open disputes. When
            you close your account we anonymise your profile and public content and delete
            your login. Records we must keep by law (such as completed orders and invoices)
            are retained for the periods in our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            .
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Us ending your account</h3>
          <p>
            We can suspend or terminate your account, take down listings, or freeze your
            wallet balance if we have reasonable grounds to believe you have broken these
            Terms or the Seller Agreement, engaged in fraud or misrepresentation, repeatedly
            failed to ship or reply to orders, triggered our anti-money-laundering,
            sanctions, or fraud controls, or harmed us or another user. If we terminate for
            cause, any positive wallet balance may be held for a period to cover chargebacks
            or claims before being released.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Appealing platform decisions</h3>
          <p>
            If we take action against your account or content (for example a suspension,
            termination, removal of a listing, or freezing of a wallet balance), you have
            the right to appeal our decision free of charge. To appeal, email{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            with the subject line &ldquo;Appeal&rdquo; and the decision reference. Your
            appeal will be reviewed by qualified staff and not by automated means alone. We
            will notify you of our reasoned decision within the timelines required by Article
            20 of Regulation (EU) 2022/2065 (the Digital Services Act).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            13. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by applicable law, STG&apos;s total liability for
            any claim arising out of these Terms is limited to the total amount paid by you
            to us in the twelve months preceding the event giving rise to the claim. The
            platform is provided as is,{' '}
            <strong>
              except where mandatory consumer-protection or other applicable law requires
              otherwise.
            </strong>{' '}
            STG connects buyers and sellers but is not a party to the sale itself; we do not
            separately warrant the condition, authenticity, or quality of items listed by
            sellers,{' '}
            <strong>save for any warranties imposed on us by mandatory law.</strong>
          </p>
          <p>Nothing in these Terms seeks to exclude or limit liability for:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>death or personal injury caused by negligence,</li>
            <li>fraud or fraudulent misrepresentation,</li>
            <li>
              any other liability which cannot be excluded or limited under Latvian consumer
              protection laws or equivalent mandatory consumer-protection rules of your
              country of habitual residence, or
            </li>
            <li>
              any statutory liability we have as an intermediary service provider under
              Regulation (EU) 2022/2065 or equivalent national law.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            14. Governing law and disputes
          </h2>
          <p>
            These Terms are governed by the laws of the Republic of Latvia. The courts of
            Riga, Latvia, have jurisdiction over disputes arising from these Terms or use of
            the platform, without prejudice to (a) the mandatory consumer protection rules of
            your country of habitual residence under Article 6 of Regulation (EC) 593/2008,
            and (b) your right as a consumer to bring proceedings in the courts of your
            country of habitual residence under Article 18 of Regulation (EU) 1215/2012.
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
                href={ADR_BODIES.LV.url}
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
                href={ADR_BODIES.LT.url}
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
                href={ADR_BODIES.EE.url}
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

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Trader-status disputes</h3>
          <p>
            If a buyer-seller dispute turns on whether the seller is really a trader under
            Directive 2011/83/EU, we will look at the seller&apos;s activity against our
            internal criteria, tell the buyer what we found, and, if we think the seller is
            likely a trader, help the buyer use their statutory rights, including a refund
            where a withdrawal right applies. Our assessment does not bind
            the courts or the consumer-protection authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            15. Changes to these Terms
          </h2>
          <p>
            We may update these Terms.{' '}
            <strong>
              For any change to fees, commissions, refund policy, dispute procedure, liability
              cap, or grounds for account termination, we will email registered users at least
              14 days before the changes take effect. For minor changes (typo fixes,
              clarifications that do not reduce your rights), we will publish the new version
              with a changelog entry.
            </strong>{' '}
            Continued use of the platform after the effective date constitutes acceptance of
            the updated Terms.{' '}
            <strong>
              Changes do not apply retroactively to orders placed before the effective date.
              Those orders remain governed by the Terms in force when you placed them.
            </strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            16. Contact and Digital Services Act information
          </h2>
          <p>
            Questions about these Terms? Reach us at{' '}
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
            users under Article 12 of Regulation (EU) 2022/2065 (the Digital Services Act).
            Use this address to reach us directly in any language spoken by our users
            (English, Latvian, Lithuanian, or Estonian) on any DSA-related matter.
          </p>
          <p>
            <strong>Point of contact for authorities.</strong> Under Article 11 of Regulation
            (EU) 2022/2065, the single point of contact for Member State authorities, the
            European Commission, and the European Board for Digital Services is{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Communications in English or Latvian are accepted.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Reporting illegal content</h3>
          <p>
            Anyone can tell us about content on Second Turn Games they think is illegal. Use
            the form at{' '}
            <Link href="/report-illegal-content" className="link-brand">
              secondturn.games/report-illegal-content
            </Link>
            {' '}or email{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . A valid notice identifies the content (a URL or listing ID), explains why you
            believe it&apos;s illegal, includes your name and email, and confirms the
            information is accurate to the best of your knowledge. Reports of suspected child
            sexual abuse material can be submitted anonymously. We acknowledge valid notices
            quickly and act where required, without undue delay. We use automated tools to
            help with triage, but every decision to remove or restrict content is reviewed by
            a human. We notify both the reporter and the affected user of the decision and
            the reasons for it, per Article 17 of Regulation (EU) 2022/2065.
          </p>

          <h3 className={LEGAL_SUB_HEADING_CLASS}>Criminal-offence notifications</h3>
          <p>
            Where we become aware of information giving rise to a suspicion that a criminal
            offence involving a threat to the life or safety of a person has taken or is
            likely to take place, we will promptly inform the law enforcement authorities of
            the Member State concerned, in accordance with Article 18 of Regulation (EU)
            2022/2065.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={LEGAL_SECTION_HEADING_CLASS}>
            17. Language
          </h2>
          <p>
            Translations of these Terms may be provided in other languages for your
            convenience. The English version is the legally binding original. In case
            of any discrepancy or conflict between the English version and any
            translation, the English version prevails.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link href="/privacy" className="link-brand">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/seller-terms" className="link-brand">
            Seller Agreement
          </Link>
          .
        </p>
      </div>
    </>
  );
}
