import Link from 'next/link';
import { CaretRight, ChatCircle, Prohibit } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

export function MessagingSection() {
  return (
    <Card>
      <CardBody>
        <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-3')}>Messages</h2>
        <ul className="divide-y divide-semantic-border-default -mx-5 sm:-mx-6">
          <SettingsLinkRow
            href="/account/settings/messaging"
            icon={ChatCircle}
            label="Message settings"
            description="Choose whether other people can start new conversations with you."
          />
          <SettingsLinkRow
            href="/account/blocked"
            icon={Prohibit}
            label="Blocked users"
            description="Review and remove blocks."
          />
        </ul>
      </CardBody>
    </Card>
  );
}

interface SettingsLinkRowProps {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description: string;
}

function SettingsLinkRow({ href, icon: Icon, label, description }: SettingsLinkRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-5 sm:px-6 py-3 sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
      >
        <Icon size={20} className="text-semantic-text-muted shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-semantic-text-primary">{label}</span>
          <span className="block text-xs text-semantic-text-muted truncate">{description}</span>
        </span>
        <CaretRight size={16} className="text-semantic-text-muted shrink-0" />
      </Link>
    </li>
  );
}
