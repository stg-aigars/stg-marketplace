import Link from 'next/link';
import type { ActionChip } from '@/lib/pending-actions/types';

interface ActionChipListProps {
  seller: ActionChip[];
  buyer: ActionChip[];
}

function ChipGroup({ chips }: { chips: ActionChip[] }) {
  return (
    <>
      {chips.map((chip, i) => (
        <span key={chip.href + chip.label} className="inline-flex items-center">
          {i > 0 && <span className="text-semantic-text-muted mx-1">&middot;</span>}
          <Link
            href={chip.href}
            className="text-semantic-text-secondary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom underline decoration-semantic-text-muted/30 underline-offset-2"
          >
            {chip.count} {chip.label}
          </Link>
        </span>
      ))}
    </>
  );
}

export function ActionChipList({ seller, buyer }: ActionChipListProps) {
  const hasBothGroups = seller.length > 0 && buyer.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
      {seller.length > 0 && <ChipGroup chips={seller} />}
      {hasBothGroups && <span className="text-semantic-text-muted mx-1">|</span>}
      {buyer.length > 0 && <ChipGroup chips={buyer} />}
    </div>
  );
}
