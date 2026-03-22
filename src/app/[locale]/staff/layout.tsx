import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { NavTabs } from '@/components/ui';

const STAFF_TABS = [
  { key: 'overview', label: 'Overview', href: '/staff' },
  { key: 'orders', label: 'Orders', href: '/staff/orders' },
  { key: 'withdrawals', label: 'Withdrawals', href: '/staff/withdrawals' },
  { key: 'disputes', label: 'Disputes', href: '/staff/disputes' },
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <NavTabs tabs={STAFF_TABS} className="mb-6" />
      {children}
    </div>
  );
}
