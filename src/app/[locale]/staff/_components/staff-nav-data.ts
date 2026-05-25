type StaffNavItem = {
  key: string;
  label: string;
  href: string;
  count?: number;
};

type StaffNavGroup = {
  label: string;
  items: StaffNavItem[];
};

const STAFF_NAV_GROUPS: StaffNavGroup[] = [
  {
    label: 'Operations',
    items: [
      { key: 'overview', label: 'Overview', href: '/staff' },
      { key: 'orders', label: 'Orders', href: '/staff/orders' },
      { key: 'disputes', label: 'Disputes', href: '/staff/disputes' },
      { key: 'notices', label: 'DSA notices', href: '/staff/notices' },
      { key: 'withdrawals', label: 'Withdrawals', href: '/staff/withdrawals' },
      { key: 'feedback', label: 'Feedback', href: '/staff/feedback' },
      { key: 'announcements', label: 'Announcements', href: '/staff/announcements' },
    ],
  },
  {
    label: 'Users & Compliance',
    items: [
      { key: 'users', label: 'Users', href: '/staff/users' },
      { key: 'dac7', label: 'DAC7', href: '/staff/dac7' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'accounting', label: 'Accounting', href: '/staff/accounting' },
      { key: 'bookkeeping', label: 'Bookkeeping', href: '/staff/bookkeeping' },
      { key: 'oss', label: 'OSS', href: '/staff/oss' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { key: 'audit', label: 'Audit log', href: '/staff/audit' },
      { key: 'templates', label: 'Templates', href: '/staff/templates' },
    ],
  },
];

function findActiveKey(pathname: string): string | undefined {
  let bestMatch: StaffNavItem | null = null;
  for (const group of STAFF_NAV_GROUPS) {
    for (const item of group.items) {
      const matches =
        pathname === item.href ||
        (item.href !== '/' && pathname.startsWith(item.href + '/'));
      if (matches && (!bestMatch || item.href.length > bestMatch.href.length)) {
        bestMatch = item;
      }
    }
  }
  return bestMatch?.key;
}

export { STAFF_NAV_GROUPS, findActiveKey };
export type { StaffNavItem, StaffNavGroup };
