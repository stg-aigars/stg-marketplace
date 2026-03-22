import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';

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
      {/* Staff nav tabs */}
      <nav className="flex gap-1 mb-6 border-b border-semantic-border-subtle pb-2">
        <Link
          href="/staff"
          className="px-4 py-2 text-sm font-medium text-semantic-text-secondary rounded-lg sm:hover:bg-semantic-bg-subtle transition-colors"
        >
          Overview
        </Link>
        <Link
          href="/staff/orders"
          className="px-4 py-2 text-sm font-medium text-semantic-text-secondary rounded-lg sm:hover:bg-semantic-bg-subtle transition-colors"
        >
          Orders
        </Link>
        <Link
          href="/staff/withdrawals"
          className="px-4 py-2 text-sm font-medium text-semantic-text-secondary rounded-lg sm:hover:bg-semantic-bg-subtle transition-colors"
        >
          Withdrawals
        </Link>
        <Link
          href="/staff/disputes"
          className="px-4 py-2 text-sm font-medium text-semantic-text-secondary rounded-lg sm:hover:bg-semantic-bg-subtle transition-colors"
        >
          Disputes
        </Link>
      </nav>
      {children}
    </div>
  );
}
