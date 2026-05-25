import Link from 'next/link';
import { CaretRight, Prohibit } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import { MessagingToggle } from './MessagingToggle';

interface MessagingSectionProps {
  messagingEnabled: boolean;
}

export function MessagingSection({ messagingEnabled }: MessagingSectionProps) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS)}>Messages</h2>

        <MessagingToggle initialValue={messagingEnabled} />

        <hr className="border-t border-semantic-border-subtle" />

        <Link
          href="/account/blocked"
          className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-md sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
        >
          <Prohibit size={20} className="text-semantic-text-muted shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-semantic-text-primary">
              Blocked users
            </span>
            <span className="block text-xs text-semantic-text-muted">
              Review and remove blocks.
            </span>
          </span>
          <CaretRight size={16} className="text-semantic-text-muted shrink-0" />
        </Link>
      </CardBody>
    </Card>
  );
}
