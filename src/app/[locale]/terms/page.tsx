import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';
import { ADR_BODIES } from '@/lib/legal/adr-bodies';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

const subHeadingClass = 'text-base font-semibold text-semantic-text-heading pt-1';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-semantic-text-heading mb-6">
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            1. About Second Turn Games
          </h2>
          <p>
            {LEGAL_ENTITY_NAME} (&ldquo;STG&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;),
            registration number {LEGAL_ENTITY_REG_NUMBER}, registered at {LEGAL_ENTITY_ADDRESS},
            runs a peer-to-peer marketplace for pre-loved board games in Latvia, Lithuania, and
            Estonia. We connect private buyers and private sellers; the sale itself is a
            contract between them, not with us.
          </p>
          <p>
            Payments go through EveryPay (Maksekeskus AS), a licensed Estonian payment
            institution. Buyer funds are held in a marketplace account and released to the
            seller once delivery is confirmed and the dispute window has closed. We are not a
            payment institution ourselves and do not hold a payment services licence. Our role
            in the payment flow is that of a commercial agent acting for sellers, relying on
            the exemption in Article 3(b) of Directive (EU) 2015/2366 (PSD2). If that
            exemption turns out not to apply, we will move the flow to a licensed payment
            institution.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            2. Eligibility
          </h2>
          <p>
            You must be at least 16 years old and reside in Latvia, Lithuania, or Estonia to use our
            platform. By creating an account, you confirm that you meet these requirements. You must be
            at least 18 years old to list items for sale.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            3. Consumer protection notice
          </h2>
          <p>
            Everyone selling on Second Turn Games is a private individual with a personal
            collection, not a business or professional trader. The EU consumer-protection rules
            that apply to business-to-consumer sales — the 14-day withdrawal right and the
            2-year guarantee of conformity — do not apply here.
          </p>
          <p>
            What you get instead: buyer funds are held until delivery, and buyers have 2 days
            after delivery to open a dispute if something&apos;s wrong.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            7. Payments
          </h2>
          <p>
            Payments are processed through EveryPay (Swedbank). Orders are only created after
            payment is confirmed. STG does not store card details. Buyer funds are held by the
            platform until the order is completed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            9. Cancellations, refunds, and disputes
          </h2>

          <h3 className={subHeadingClass}>
            Order cancellations
          </h3>
          <p>
            A seller may decline an order within 48 hours. If a seller does not respond within
            48 hours, or does not ship within 5 days of accepting, the order is cancelled
            automatically. In both cases you get a full refund. Buyers cannot cancel after
            payment &mdash; orders are binding once paid.
          </p>

          <h3 className={subHeadingClass}>
            Returns and replacements
          </h3>
          <p>
            Returns and replacements are not available. All sellers are private individuals
            selling personal items, not retailers, so the 14-day EU withdrawal right does not
            apply (see Section 3). Each listed item is one of a kind, so we cannot offer
            replacements. If an item arrives damaged or does not match its description, you may
            open a dispute (see below).
          </p>

          <h3 className={subHeadingClass}>
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

          <h3 className={subHeadingClass}>
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            10. Prohibited content
          </h2>
          <p>
            Listings must be for board games only. Counterfeit items, stolen goods, and items that
            violate intellectual property rights are strictly prohibited. STG reserves the right to
            remove any listing or suspend any account that violates these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            12. Marketplace features
          </h2>
          <p>
            Beyond a standard listing, you can ask a public question on someone&apos;s
            listing, run or bid in an auction, or post a wanted listing. This section
            describes how each works and what it means.
          </p>

          <h3 className={subHeadingClass}>
            Listing questions
          </h3>
          <p>
            Each listing has a public comment thread where anyone can ask the seller
            about the game. Comments are flat (oldest first), limited to 1,000
            characters, and cannot be edited once posted. The seller is notified on
            every new comment; if the seller replies, everyone who commented
            previously on that listing is also notified. Comments are visible to
            anyone viewing the listing. We may remove comments that violate these
            Terms or are flagged through the process in Section 18 (Reporting illegal
            content), and we will tell you why if we do.
          </p>

          <h3 className={subHeadingClass}>
            Auctions
          </h3>
          <p>
            When you list a game in auction format, you accept a binding sale to the
            highest bidder at close. You can withdraw an auction listing only while it
            has no bids; once any bid has been placed you cannot withdraw the listing
            and you must honour the winning bid at close. This rule is absolute &mdash;
            there is no exception for damage, loss, or change of mind.
          </p>
          <p>
            When you place a bid, you commit to buying the game at your bid price if
            you win. All bids are binding. If a bid is placed in the final 5 minutes,
            the auction end time extends by 5 minutes to prevent last-second sniping.
            Thirty minutes before an auction ends, we notify the seller and everyone
            who has bid.
          </p>
          <p>
            When you win, you have 24 hours to pay. We send a reminder 12 hours before
            the deadline. If you do not pay in time, the listing is cancelled by the
            platform and the seller is free to re-list the game &mdash; no order is
            created until payment completes.
          </p>

          <h3 className={subHeadingClass}>
            Wanted listings
          </h3>
          <p>
            A wanted listing is a notification trigger, not a purchase commitment.
            When you post a wanted listing, we email you when a matching game is
            listed. You are not reserving any game, not committing to buy, and not
            binding any seller.
          </p>
          <p>
            Wanted listings stay active until you cancel them. Other users can browse
            the wanted board and see what games people are looking for. When you
            receive a match notification, you decide whether to buy the game like any
            other listing. The standard rules on payment, shipping, and disputes apply
            at that point.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            13. Ending your account or our services
          </h2>

          <h3 className={subHeadingClass}>
            You ending your account
          </h3>
          <p>
            You can close your account at any time from your account settings. Closure happens
            immediately. Before we can close it you need to (a) cancel or complete any active
            listings and in-progress orders, (b) withdraw any positive wallet balance, and
            (c) resolve any open disputes. When you close the account we anonymise your
            profile, your public comments, and your order messages so they no longer point
            back at you; cancel any stray listings; remove your photos from storage within
            six hours; and delete your login in our authentication system. Records we have to
            keep by law — completed-order data, invoices, DAC7 reporting data, and security
            logs — stay for the periods listed in Section 9 of our{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            , and they do not link back to your anonymised account except where the law
            requires the link to survive.
          </p>

          <h3 className={subHeadingClass}>
            Us ending your account
          </h3>
          <p>
            We can suspend or terminate your account, take down listings, or freeze your
            wallet balance if we have reasonable grounds to believe you have (a) broken these
            Terms or the Seller Agreement, (b) engaged in fraud, misrepresentation, or
            commercial reselling, (c) repeatedly failed to ship or reply to orders, (d) racked
            up too many chargebacks, (e) triggered our anti-money-laundering, sanctions, or
            fraud controls, or (f) harmed us or another user. When we do, we tell you why and
            how to dispute it, per Article 17 of Regulation (EU) 2022/2065 (the Digital
            Services Act). If we terminate for cause, any positive wallet balance is payable
            to you minus anything you owe us, and we may hold it for up to 180 days to cover
            chargebacks or claims before releasing.
          </p>

          <h3 className={subHeadingClass}>
            Appealing platform decisions
          </h3>
          <p>
            If we take action against your account or content &mdash; a suspension, termination,
            removal of a listing, freezing of a wallet balance, or any other restriction we
            apply on grounds described above &mdash; you have the right to appeal our decision
            free of charge within six months of the decision. To appeal, email{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>{' '}
            with the subject line &ldquo;Appeal &mdash; [Decision ID or Reference]&rdquo;.
            Your appeal will be reviewed by qualified staff and not by automated means alone.
            We will notify you of our reasoned decision without undue delay and, in any event,
            within the timelines required by Article 20 of Regulation (EU) 2022/2065 (the
            Digital Services Act). If our decision was wrong we will reinstate your account or
            content; if it stands, we will explain why and remind you of your further redress
            options under Sections 15 and 17.
          </p>

          <h3 className={subHeadingClass}>
            Effect of termination
          </h3>
          <p>
            Termination does not affect any rights or obligations that have accrued up to the
            date of termination. The clauses on liability (Section 14), governing law and
            jurisdiction (Section 15), and reporting obligations under applicable tax law
            survive termination indefinitely.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            14. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by applicable law, STG&apos;s total liability for
            any claim arising out of these Terms is limited to the total amount paid by you to
            us in the twelve months preceding the event giving rise to the claim. The platform
            is provided as is,{' '}
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            15. Governing law and disputes
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

          <h3 className={subHeadingClass}>
            Trader-status disputes
          </h3>
          <p>
            If a buyer-seller dispute turns on whether the seller is really a trader under
            Directive 2011/83/EU, we will look at the seller&apos;s activity against our
            internal criteria, tell the buyer what we found, and — if we think the seller is
            likely a trader — help the buyer use their statutory rights, including a refund
            where a withdrawal right applies. Our assessment does not bind the courts or the
            consumer-protection authorities.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            16. Changes to these terms
          </h2>
          <p>
            We may update these Terms from time to time.{' '}
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
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            17. Contact
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
          <p>
            <strong>Point of contact for authorities.</strong> Under Article 11 of Regulation
            (EU) 2022/2065, the single point of contact for Member State authorities, the
            European Commission, and the European Board for Digital Services is{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            . Communications in English or Latvian are accepted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            18. Reporting illegal content
          </h2>
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
          <p>
            <strong>Criminal-offence notifications.</strong> Where we become aware of
            information giving rise to a suspicion that a criminal offence involving a threat
            to the life or safety of a person has taken or is likely to take place, we will
            promptly inform the law enforcement authorities of the Member State concerned, in
            accordance with Article 18 of Regulation (EU) 2022/2065.
          </p>
        </section>

        <div className="pt-4 border-t border-semantic-border-subtle space-y-3">
          <p className="text-xs text-semantic-text-muted">
            <strong>Version 2026-04-30</strong> — added an explicit appeal path for
            platform decisions under Article 20 of the Digital Services Act (Section 13);
            replaced the prior &euro;500 floor in the liability cap with a 12-month
            spend cap and broadened the consumer-protection carve-out (Section 14).
          </p>
          <p className="text-xs text-semantic-text-muted">
            <strong>Version 2026-04-28</strong> — the liability cap now carries the
            consumer-protection priority inline rather than in a separate paragraph, and the
            &ldquo;as is&rdquo; wording is bounded by mandatory law. Material-change updates
            now require 14 days&rsquo; email notice before they take effect, and they
            don&rsquo;t apply to orders already placed when the change lands.
          </p>

          <p className="text-sm text-semantic-text-muted">
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
    </div>
  );
}
