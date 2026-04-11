import { cn } from '@/lib/cn';

const base = 'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-semantic-error text-semantic-text-inverse';

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn(base, className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
