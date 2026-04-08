export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-aurora-red text-white ${className ?? ''}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
