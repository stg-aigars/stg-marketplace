import { Card, CardBody } from '@/components/ui';
import { CompleteProfileForm } from '../_components/CompleteProfileForm';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';

export const metadata = {
  title: 'Complete your profile',
};

export default async function CompleteProfilePage(
  props: {
    searchParams: Promise<{ returnUrl?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className={PAGE_HEADING_CLASS}>
            Almost there
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Confirm your country so we can show you the right games and prices
          </p>
        </div>

        <Card>
          <CardBody>
            <CompleteProfileForm returnUrl={searchParams.returnUrl} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
