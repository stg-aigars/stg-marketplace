import type { Metadata } from 'next';
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
          If you believe a listing, comment, or other content on Second Turn Games is illegal,
          this is the place to tell us. We action valid notices without undue delay and review
          every decision before removing or restricting content. You will be notified of the
          outcome, as will the user who posted the content, in accordance with Article 17 of
          Regulation (EU) 2022/2065 (the Digital Services Act).
        </p>
        <p>
          If this is not an urgent matter and does not concern illegal content, please use our{' '}
          <a href="/contact" className="link-brand">
            contact page
          </a>{' '}
          instead. For data-protection questions, use{' '}
          <a href="mailto:privacy@secondturn.games" className="link-brand">
            privacy@secondturn.games
          </a>
          .
        </p>
        <p className="text-xs text-semantic-text-muted">
          If your notice concerns content that constitutes a criminal offence involving the sexual
          exploitation of minors, you may submit anonymously by leaving the name and email fields
          blank.
        </p>
      </div>

      <ReportIllegalContentForm />
    </div>
  );
}
