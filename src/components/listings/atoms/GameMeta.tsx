interface GameMetaProps {
  year?: number | null;
  publisher?: string | null;
  className?: string;
}

function GameMeta({ year, publisher, className = '' }: GameMetaProps) {
  if (!year && !publisher) return null;

  const parts = [year, publisher].filter(Boolean);

  return (
    <span className={`text-xs text-semantic-text-muted font-sans truncate block ${className}`}>
      {parts.join(' \u00B7 ')}
    </span>
  );
}

export { GameMeta };
export type { GameMetaProps };
