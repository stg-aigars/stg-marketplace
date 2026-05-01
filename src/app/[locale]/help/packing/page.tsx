import type { Metadata } from 'next';
import { BackLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'How to Pack Your Board Game',
};

export default function PackingGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/help" label="Help Center" />

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-2 mt-4">
        How to pack your board game for shipping
      </h1>
      <p className="text-semantic-text-muted mb-6">
        A well-packed game arrives in the same condition it left your shelf. Five extra minutes
        with some cardboard and tape go a long way.
      </p>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-8">
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Before you pack
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">
            Secure loose components
          </h3>
          <p>
            Open the box and check that all bagged pieces, cards, boards, and manuals sit snugly
            inside. If there&apos;s extra space, stuff in a sheet of crumpled paper or a bit of
            cardboard so nothing rattles around.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">
            Take a quick photo
          </h3>
          <p>
            Snap the open box before sealing it. If a dispute ever comes up, you&apos;ll have
            a reference. Takes five seconds, saves a lot of back-and-forth.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Choosing your outer packaging
          </h2>
          <p>
            The game box on its own isn&apos;t enough. It needs an outer layer.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">
            Cardboard box (best option)
          </h3>
          <p>
            A corrugated shipping box slightly larger than the game box on all sides. You can find
            them at Depo, K-Senukai, or order from Latvijas Pasts and Omniva shops. A box from a
            recent online order works just as well. Reuse is encouraged.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">
            Bubble mailer or padded envelope
          </h3>
          <p>
            Fine for card games and slim travel editions. Not great for standard or heavy board
            games, though. Corners tend to get crushed.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">
            What to avoid
          </h3>
          <p>
            Just a plastic bag or thin paper. Parcel terminals are automated, so your package
            will be handled by machines, not careful hands.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Step by step
          </h2>
          <ol className="list-decimal pl-5 space-y-3">
            <li>
              <strong className="text-semantic-text-heading">Wrap the game box.</strong>{' '}
              Bubble wrap is ideal. Several layers of newspaper or brown packing paper also work.
              Pay extra attention to the corners, they take the most impact.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Place it inside the outer box.</strong>{' '}
              Leave at least 2–3 cm of gap on every side. Fill that gap with crumpled paper,
              cardboard scraps, or packing peanuts. Give the box a gentle shake. If the game
              slides around, add more padding.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Seal it properly.</strong>{' '}
              Use packing tape (the wide brown or clear kind), not office tape or masking tape.
              Run tape along all seams. If you&apos;re reusing a box, cover or remove old shipping
              labels and barcodes so scanners don&apos;t get confused.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Attach the shipping label.</strong>{' '}
              Print the shipping label and stick it on the largest flat surface. Make sure
              it&apos;s fully visible and not folded over an edge. If you tape over the label
              for weather protection, use clear tape. Then drop it at any terminal that
              supports sending (some terminals are receive-only).
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Weather in the Baltics
          </h2>
          <p>
            Rain, sleet, and snow are just part of life here. Many parcel lockers are outdoors,
            and your buyer might not pick up the package right away.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-semantic-text-heading">Add a waterproof layer.</strong>{' '}
              Before placing the game in the outer box, slip it into a plastic bag (a regular
              shopping bag works) and loosely close it. Protects against moisture if the locker
              isn&apos;t fully sealed or the buyer opens it in the rain.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Cold months</strong> make cardboard
              brittle and tape less sticky. Press your tape down firmly and consider doubling it
              along the main seams.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Spring and autumn humidity</strong>{' '}
              can soften cardboard over a few days. Don&apos;t leave your packed game sitting
              around too long before dropping it at the terminal.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Locker sizes
          </h2>
          <p>
            The Unisend network includes Unisend, Latvijas Pasts, and uDrop terminals.
            Lockers come in five sizes. Most standard board games (Catan, Ticket to Ride,
            Carcassonne) fit in M. Larger games like Gloomhaven need L or XL, and some might
            not fit at all once you add padding.
          </p>
          <p>
            If you&apos;re listing a big or unusually shaped game, measure it packed and check the
            weight. Maximum parcel weight is 30 kg. When in doubt, mention the size in your
            listing so there are no surprises.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">Size</th>
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">Dimensions (cm)</th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">Good for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4 font-medium text-semantic-text-heading">XS</td>
                  <td className="py-2 pr-4">8 &times; 18.5 &times; 61</td>
                  <td className="py-2">Card games, small box games</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-semantic-text-heading">S</td>
                  <td className="py-2 pr-4">8 &times; 35 &times; 61</td>
                  <td className="py-2">Slim games (Codenames, Jaipur)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-semantic-text-heading">M</td>
                  <td className="py-2 pr-4">17.5 &times; 35 &times; 61</td>
                  <td className="py-2">Standard games (Catan, Ticket to Ride)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-semantic-text-heading">L</td>
                  <td className="py-2 pr-4">36.5 &times; 35 &times; 61</td>
                  <td className="py-2">Larger games (Wingspan, Terraforming Mars)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-semantic-text-heading">XL</td>
                  <td className="py-2 pr-4">74.5 &times; 35 &times; 61</td>
                  <td className="py-2">Big box games (Gloomhaven, large collections)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm text-semantic-text-muted">
            These are compartment dimensions, not your maximum box size. Your packed game needs
            to fit with room to spare.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Quick checklist
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Components secured inside the game box</li>
            <li>Game box wrapped in bubble wrap or thick paper</li>
            <li>Plastic bag around the game for waterproofing</li>
            <li>Outer cardboard box with 2–3 cm padding on all sides</li>
            <li>All seams sealed with packing tape</li>
            <li>Old labels removed or covered on reused boxes</li>
            <li>Shipping label printed and clearly visible</li>
            <li>Package fits the selected locker size</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Where to find packing materials
          </h2>
          <p>
            You don&apos;t need anything special.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-semantic-text-heading">Free boxes</strong> from your own
              online orders, or ask at Maxima, Rimi, or Lidl. Stores often have spare cardboard
              out back.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Bubble wrap and tape</strong> from
              Depo, K-Senukai, Jysk, or any office supply shop. Latvijas Pasts and Omniva post
              offices sell basic packaging supplies too.
            </li>
            <li>
              <strong className="text-semantic-text-heading">Newspaper or brown kraft paper</strong>{' '}
              you already have at home works fine for cushioning.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            If something goes wrong
          </h2>
          <p>
            Even with careful packing, things sometimes get damaged in transit. This is where
            those pre-shipping photos pay off. If a buyer reports damage, the photos help both
            sides figure out what happened without guesswork.
          </p>
        </section>
      </div>
    </div>
  );
}
