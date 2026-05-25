import Link from 'next/link';
import { Prohibit } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { MessagingToggle } from './MessagingToggle';

interface InboxSettingsProps {
  messagingEnabled: boolean;
}

export function InboxSettings({ messagingEnabled }: InboxSettingsProps) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <MessagingToggle initialValue={messagingEnabled} />
        <hr className="border-t border-semantic-border-subtle" />
        <Link
          href="/account/blocked"
          className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-md sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
        >
          <Prohibit size={20} className="text-semantic-text-muted shrink-0" />
          <span className="flex-1 min-w-0 text-sm font-medium text-semantic-text-primary">
            Blocked users
          </span>
        </Link>
      </CardBody>
    </Card>
  );
}
