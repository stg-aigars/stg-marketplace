import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { TrustBand } from '@/components/marketing/TrustBand';
import { LEGAL_ENTITY_EMAIL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About — Second Turn Games',
  description:
    'A small Latvian company building a Baltic board game marketplace. Listings via BoardGameGeek, parcel-locker shipping, secure payments.',
};

export default function AboutPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-6">
          About Second Turn Games
        </h1>

        <Image
          src="/images/aigars.jpg"
          alt="Aigars Grenins, founder of Second Turn Games, with the Spiel Essen mascot"
          width={240}
          height={240}
          className="rounded-lg mb-6 mx-auto shadow-sm"
        />

        <Card>
          <CardBody className="space-y-4 text-semantic-text-secondary leading-relaxed">
            <p className="text-lg">
              Second Turn Games started where most board game purchases end: on a shelf. After
              years of watching games travel through Facebook groups — strangers in DMs, untracked
              envelopes, prices invented at the kitchen table, weeknight handoffs rescheduled
              twice — I wanted something that worked the way you&apos;d expect any other purchase
              to work.
            </p>
            <p className="text-lg">
              Listings tied to BoardGameGeek so the game data is right. Price suggestions from
              BoardGamePrices so sellers aren&apos;t guessing. Secure payments so nobody&apos;s
              wiring money to a stranger. Parcel lockers across Latvia, Lithuania, and Estonia so
              shipping is a real service, not a favor. And a clear path when something goes
              wrong, so buying from a stranger doesn&apos;t have to feel like one.
            </p>
            <p className="text-lg">
              That&apos;s all this is, really. A small Latvian company building the marketplace I
              wanted as a player. Twenty years in the hobby, somewhere around 300 games on the
              shelf, and I&apos;m still no good at culling. So I built this partly for myself. 
              Mostly for the rest of you, though.
            </p>
            <p className="text-lg">
              {' '}
              <span className="font-semibold text-semantic-text-heading">
                Every game deserves a Second Turn
              </span>
              , and pre-loved games deserve a place that treats them seriously, not a thread buried
              in someone&apos;s group feed. If you&apos;re here in the early days, buying or
              selling, you&apos;re shaping what this becomes. Send feedback to{' '}
              <a href={`mailto:${LEGAL_ENTITY_EMAIL}`} className="link-brand">
                {LEGAL_ENTITY_EMAIL}
              </a>
              .
            </p>
            <p className="text-sm text-semantic-text-muted">
              — Aigars Grenins, founder
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-10">
        <TrustBand includeBgp />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 pb-6">
        <p className="text-sm text-semantic-text-muted">
          Second Turn Games SIA is registered in Latvia. Full company details are in the{' '}
          <Link href="/imprint" className="link-brand">
            imprint
          </Link>
          .
        </p>
      </div>
    </>
  );
}
