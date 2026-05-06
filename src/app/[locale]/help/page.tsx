import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help Center',
};

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
        Help Center
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-8">
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Buying games
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How do I buy a game?
          </h3>
          <p>
            Browse the marketplace, find a game you like, and open the listing. Pick a parcel
            locker for delivery, then pay with card, bank link, or wallet balance. Once
            payment succeeds, the order is created and the seller ships it to your chosen
            locker.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            Which payment methods can I use?
          </h3>
          <p>
            Cards (Visa, Mastercard), bank payments from major Baltic banks, and mobile
            wallets like Apple Pay and Google Pay &mdash; all through Swedbank&apos;s hosted
            payment page. Available methods may vary by bank and device. If you&apos;ve sold
            games before and have wallet balance, you can pay partly or fully from your
            wallet as well.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How much is shipping?
          </h3>
          <p>
            It depends on the route (which country the seller is in and which country
            you&apos;re in). All shipments go through the Unisend parcel network, which
            includes Unisend, Latvijas Pasts, and uDrop terminals across Latvia, Lithuania,
            and Estonia. You see the exact shipping cost at checkout before you pay.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            Where do you ship and how long does it take?
          </h3>
          <p>
            We currently support Latvia, Lithuania, and Estonia, and you can ship between all
            three countries. Domestic deliveries usually take 1&ndash;3 business days;
            cross-border shipments typically take 2&ndash;5 business days depending on the
            route.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Selling games
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How do I list a game?
          </h3>
          <p>
            Go to{' '}
            <Link href="/sell" className="link-brand">
              List a game
            </Link>
            , search for your game, pick the correct edition, add photos, set the condition
            and price, and publish. Buyers across all three Baltic countries can see it right
            away.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            What are the fees?
          </h3>
          <p>
            We charge 10% commission on the item price (not on shipping). There are no
            listing fees and no monthly charges &mdash; you only pay when a game sells.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How does shipping work for sellers?
          </h3>
          <p>
            All shipments go through the Unisend network, which includes Unisend, Latvijas
            Pasts, and uDrop terminals. When you accept an order as a seller, you&apos;ll
            get shipping instructions with a barcode. Drop the package at any terminal that
            supports sending (some are receive-only; you&apos;ll see this during terminal
            selection at checkout). The buyer picks it up from their chosen locker.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How quickly do I need to accept and ship orders?
          </h3>
          <p>
            The seller has a limited time (for example, 48 hours) to accept the order, then
            several days (for example, 5 days) to ship it. You can track the whole flow on
            your{' '}
            <Link href="/account/orders" className="link-brand">
              orders page
            </Link>
            . If you do not accept or ship in time, the order may be cancelled and the buyer
            refunded.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How should I pack games?
          </h3>
          <p>
            Good packing protects the game and avoids disputes. Use a sturdy box, tape it
            well, and protect corners and minis from impact. Baltic weather can be rough
            &mdash; add plastic or extra padding if rain or snow is likely. We have a full{' '}
            <Link href="/help/packing" className="link-brand">
              packing guide
            </Link>{' '}
            with step-by-step instructions, locker sizes, and tips for Baltic weather.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Auctions and wanted listings
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How do auctions work?
          </h3>
          <p>
            Some listings can be run as auctions instead of fixed-price sales. When you bid
            in an auction, your bids are binding &mdash; if you place the winning bid,
            you&apos;re committing to buy at that price and must pay within the payment
            window shown on the listing.
          </p>
          <p>
            As a seller, you can withdraw an auction listing only while it has no bids. Once
            any bid has been placed, you must honour the auction and sell to the highest
            bidder at close. If the winner does not pay in time, the platform may cancel the
            auction and return the game to your inventory so you can relist it.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            What is a wanted listing?
          </h3>
          <p>
            A wanted listing lets you say &ldquo;I&apos;m looking for this game&rdquo;. When
            someone lists a matching game, we can notify you, but this does not reserve the
            game or obligate anyone. You still need to place a normal order if you want to
            buy, and the seller can choose any buyer they like.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Wallet, payouts, and tax
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            When do I get paid for a sale?
          </h3>
          <p>
            When an order completes, your earnings (item price minus 10% commission) go into
            your wallet on Second Turn Games. An order completes when the buyer confirms
            delivery or the short dispute window expires without any issue being raised.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How do wallet withdrawals work?
          </h3>
          <p>
            You can withdraw your wallet balance to a bank account (IBAN) you own.
            Withdrawals are usually processed within 1&ndash;3 business days after approval,
            but bank processing times may vary.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            Why do you ask for my ID or tax number?
          </h3>
          <p>
            Before your first withdrawal, our payment partners may need to verify your
            identity and that the IBAN belongs to you &mdash; this is a standard
            anti-money-laundering (AML) and &ldquo;Know Your Customer&rdquo; check. If your
            selling volume passes certain thresholds in a calendar year (for example, 30
            sales or €2,000 in payouts), EU rules (DAC7) also require us to collect extra
            details such as your full name, address, date of birth, and tax identification
            number so we can report your marketplace income to the Latvian tax authority on
            time.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            Can my payout be delayed or my wallet frozen?
          </h3>
          <p>
            In some cases we may delay a payout or temporarily freeze your wallet while we
            check for fraud, chargebacks, sanctions or AML issues, or repeated policy
            violations. If that happens, we&apos;ll tell you as soon as we are legally
            allowed to, and you can appeal any decision via{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
          <p className="text-xs text-semantic-text-muted">
            For the formal rules, see the{' '}
            <Link href="/seller-terms#suspension-and-risk-controls" className="link-brand">
              suspension and risk controls section
            </Link>{' '}
            of our Seller Agreement.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            Do you take care of my income tax?
          </h3>
          <p>
            No. We charge commission and handle DAC7 reporting where required, but
            you&apos;re responsible for declaring your sales income to the tax authority in
            your country, subject to any private-seller thresholds that apply. We cannot
            provide personal tax advice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Cancellations, refunds, and disputes
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            When can an order be cancelled?
          </h3>
          <p>
            Orders may be cancelled if the seller declines the order, does not accept it in
            time, or fails to ship in time. In those cases the buyer is refunded in full.
            Once you&apos;ve paid, you cannot cancel just because you changed your mind.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            When can I get a refund?
          </h3>
          <p>
            You can get a refund if the seller cancels or times out on an order, or if a
            dispute is resolved in your favour (for example, the game is damaged, incomplete,
            or not as described). Refunds go back to the original payment method; any wallet
            portion is refunded to your wallet.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How does the dispute process work?
          </h3>
          <p>
            Once your parcel is delivered, you have a short window (currently 2 days) to
            inspect the game. If something is wrong, open a dispute from your{' '}
            <Link href="/account/orders" className="link-brand">
              orders page
            </Link>
            , upload photos, and describe the issue. The seller can respond, and the two of
            you have several days to agree on a solution, such as a partial or full refund.
          </p>
          <p>
            If you can&apos;t agree, you can ask our team to step in. We&apos;ll look at the
            listing, messages, and photos and make a decision. In serious cases, we may also
            restrict or remove a seller&apos;s access to the platform.
          </p>
          <p className="text-xs text-semantic-text-muted">
            For the formal rules, see our{' '}
            <Link href="/terms#cancellations-refunds" className="link-brand">
              Terms of Service section on cancellations, refunds, and disputes
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Account and data
          </h2>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            How do I update my account details?
          </h3>
          <p>
            Go to{' '}
            <Link href="/account/settings" className="link-brand">
              account settings
            </Link>{' '}
            to update your display name, email, password, or phone number.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            Can I export my data?
          </h3>
          <p>
            Yes. In account settings you can export your data as JSON. This includes your
            profile, listings, and order history.
          </p>

          <h3 className="text-base font-semibold text-semantic-text-heading">
            What happens if I delete my account?
          </h3>
          <p>
            You can permanently delete your account from the same page. Deletion is
            immediate: your profile is anonymised, your public comments and messages are
            de-linked from you, and active listings are deactivated. We still have to keep
            some records &mdash; like invoices, completed orders, and DAC7 reports &mdash;
            for the periods required by law, but they are no longer tied to an active
            profile.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            About Second Turn Games
          </h2>
          <p>
            Second Turn Games is a marketplace for pre-loved board games in Latvia,
            Lithuania, and Estonia. Every game deserves a second turn at the table.
          </p>
          <p>
            Question not covered here?{' '}
            <Link href="/contact" className="link-brand">
              Get in touch
            </Link>{' '}
            and we&apos;ll be happy to help.
          </p>
        </section>
      </div>
    </div>
  );
}
