import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { StaffSideNav } from './_components/StaffSideNav';
import { StaffMobileNav } from './_components/StaffMobileNav';

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-muted">
            Staff dashboard
          </p>
          <StaffMobileNav />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:flex lg:gap-8">
        <StaffSideNav />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
