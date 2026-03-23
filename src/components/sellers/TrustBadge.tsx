import { ShieldCheck } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui';
import { type TrustTier, TRUST_TIER_CONFIG } from '@/lib/services/sellers';

interface TrustBadgeProps {
  tier: TrustTier;
}

function TrustBadge({ tier }: TrustBadgeProps) {
  const config = TRUST_TIER_CONFIG[tier];
  if (!config.show) return null;

  return (
    <Badge variant="trust">
      <span className="inline-flex items-center gap-1">
        <ShieldCheck size={14} weight="fill" />
        {config.label}
      </span>
    </Badge>
  );
}

export { TrustBadge };
export type { TrustBadgeProps };
