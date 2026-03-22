import { Card, CardBody } from '@/components/ui';
import { CompleteProfileForm } from '../_components/CompleteProfileForm';

export const metadata = {
  title: 'Complete your profile',
};

export default function CompleteProfilePage({
  searchParams,
}: {
  searchParams: { returnUrl?: string };
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
            Almost there
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Confirm your country so we can set up your marketplace experience
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
