import type { Metadata } from 'next';
import Link from 'next/link';
import { ReportIllegalContentForm } from './ReportIllegalContentForm';

export const metadata: Metadata = {
  title: 'Report illegal content',
};

export default function ReportIllegalContentPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Report illegal content
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-4 mb-6">
        <p>
          If you think a listing, comment, or other content on Second Turn Games is illegal,
          this is where you tell us. We act on valid notices quickly, and every decision to
          remove or restrict content is reviewed by a human. You&apos;ll hear back from us
          with the outcome, and so will the user who posted the content — per Article 17 of
          Regulation (EU) 2022/2065 (the Digital Services Act).
        </p>
        <p>
          If this isn&apos;t about illegal content, use our{' '}
          <Link href="/contact" className="link-brand">
            contact page
          </Link>{' '}
          instead. For data-protection questions, email{' '}
          <a href="mailto:privacy@secondturn.games" className="link-brand">
            privacy@secondturn.games
          </a>
          .
        </p>
        <p className="text-xs text-semantic-text-muted">
          If you&apos;re reporting suspected child sexual abuse material, you can submit
          anonymously — leave the name and email fields blank.
        </p>
      </div>

      <ReportIllegalContentForm />
    </div>
  );
}
