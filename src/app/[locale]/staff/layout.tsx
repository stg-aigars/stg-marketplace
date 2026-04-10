import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { NavTabs } from '@/components/ui';

const STAFF_TABS = [
  { key: 'overview', label: 'Overview', href: '/staff' },
  { key: 'orders', label: 'Orders', href: '/staff/orders' },
  { key: 'bookkeeping', label: 'Bookkeeping', href: '/staff/bookkeeping' },
  { key: 'withdrawals', label: 'Withdrawals', href: '/staff/withdrawals' },
  { key: 'disputes', label: 'Disputes', href: '/staff/disputes' },
  { key: 'dac7', label: 'DAC7', href: '/staff/dac7' },
  { key: 'showcase', label: 'Components', href: '/staff/showcase' },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isStaff } = await requireServerAuth();

  if (!isStaff) {
    redirect('/');
  }

  return (
    <div>
      <div className="bg-frost-ice/5 border-b border-frost-ice/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-3">
            Staff Dashboard
          </h1>
          <NavTabs tabs={STAFF_TABS} />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
    </div>
  );
}
