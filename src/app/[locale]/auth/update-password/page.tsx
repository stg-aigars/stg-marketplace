import { Card, CardBody } from '@/components/ui';
import { UpdatePasswordForm } from '../_components/UpdatePasswordForm';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';

export const metadata = {
  title: 'Update password',
};

export default function UpdatePasswordPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className={PAGE_HEADING_CLASS}>
            Set a new password
          </h1>
        </div>

        <Card>
          <CardBody>
            <UpdatePasswordForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
