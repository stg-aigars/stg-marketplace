import { Sparkle } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui';

function EarlyMemberBadge() {
  return (
    <Badge variant="accent">
      <span className="inline-flex items-center gap-1">
        <Sparkle size={14} weight="fill" />
        Early member
      </span>
    </Badge>
  );
}

export { EarlyMemberBadge };
