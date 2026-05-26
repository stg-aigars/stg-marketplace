import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody } from '@/components/ui';
import { CreateWantedForm } from './CreateWantedForm';
import { PAGE_HEADING_CLASS, CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Post a wanted game',
};

export default async function CreateWantedPage() {
  await requireServerAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Post a wanted game
      </h1>

      <Card className="mb-6">
        <CardBody className="space-y-3">
          <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
            How wanted listings work
          </h2>
          <div className="space-y-2 text-sm text-semantic-text-secondary">
            <p>
              <span className="font-medium text-semantic-text-heading">Sellers see it.</span>{' '}
              Your listing appears on the public Wanted board where any seller can find it.
            </p>
            <p>
              <span className="font-medium text-semantic-text-heading">You get notified.</span>{' '}
              When someone lists this game, we&rsquo;ll send you an in-app and email notification.
            </p>
            <p>
              <span className="font-medium text-semantic-text-heading">Sellers can message you.</span>{' '}
              Anyone with a copy can reach out to ask about edition, condition, or price before listing.
            </p>
          </div>
          <p className="text-xs text-semantic-text-muted pt-1">
            You can edit or remove your wanted listing anytime from your account.
          </p>
        </CardBody>
      </Card>

      <CreateWantedForm />
    </div>
  );
}
