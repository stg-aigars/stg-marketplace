import { Card, CardBody } from '@/components/ui';
import { UpdatePasswordForm } from '../_components/UpdatePasswordForm';

export const metadata = {
  title: 'Update password',
};

export default function UpdatePasswordPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
            Set a new password
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Choose a strong password with at least 8 characters
          </p>
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
