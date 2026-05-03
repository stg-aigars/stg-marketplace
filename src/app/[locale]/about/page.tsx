import type { Metadata } from 'next';
// import Image from 'next/image'; // uncomment when founder photo lands at public/images/aigars.jpg
import Link from 'next/link';
import { LEGAL_ENTITY_EMAIL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About — Second Turn Games',
  description:
    'A small Latvian company building a Baltic board game marketplace. Listings via BoardGameGeek, parcel-locker shipping, Swedbank payments.',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
        About Second Turn
      </h1>

      {/* Founder photo — uncomment after photo lands at public/images/aigars.jpg */}
      {/* <Image
        src="/images/aigars.jpg"
        alt="Aigars Grenins, founder of Second Turn Games"
        width={192}
        height={192}
        className="aspect-square rounded-full mt-6"
      /> */}

      <div className="mt-6 space-y-4 text-base leading-relaxed text-semantic-text-secondary">
        <p>
          Second Turn started where most board game purchases end: on a shelf. After years of
          watching games travel through Facebook groups — strangers in DMs, untracked envelopes,
          prices invented at the kitchen table — I wanted something that worked the way the rest
          of the internet does. Listings tied to BoardGameGeek so the metadata is right. Card
          payments through Swedbank so nobody&apos;s wiring money to a stranger. Parcel lockers
          across the Baltics so the shipping is a real service, not a favor.
        </p>
        <p>
          That&apos;s all this is, really. A small Latvian company building the marketplace I
          wanted as a player. Every game deserves a second turn — and so does every seller who&apos;d
          rather list once and forget about it than negotiate three times for the same copy of
          Wingspan. If you&apos;re an early seller, you&apos;re shaping what this becomes. Send
          feedback to{' '}
          <a href={`mailto:${LEGAL_ENTITY_EMAIL}`} className="link-brand">
            {LEGAL_ENTITY_EMAIL}
          </a>
          .
        </p>
      </div>

      <p className="mt-8 text-sm text-semantic-text-muted">
        Registered in Latvia. See our{' '}
        <Link href="/imprint" className="link-brand">
          imprint
        </Link>
        {' '}for full company details.
      </p>
    </div>
  );
}
