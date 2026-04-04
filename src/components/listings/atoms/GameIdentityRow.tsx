import { Tag, Translate, Buildings, CalendarBlank } from '@phosphor-icons/react/ssr';
import { GameThumb } from './GameThumb';

interface GameIdentityRowProps {
  /** Thumbnail URL (BGG or user upload) */
  thumbnail?: string | null;
  /** Game/expansion name */
  name: string;
  /** Makes name a clickable link */
  href?: string;
  /** Link target (e.g., '_blank' for external BGG links) */
  target?: string;
  /** Edition/version name (e.g., "German First Edition") */
  versionName?: string | null;
  /** Language(s) */
  language?: string | null;
  /** Publisher(s) */
  publisher?: string | null;
  /** Edition year */
  year?: number | null;
  /** Thumbnail size — maps to GameThumb sizes */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional trailing action (remove button, edit button, etc.) */
  action?: React.ReactNode;
}

function GameIdentityRow({
  thumbnail,
  name,
  href,
  target,
  versionName,
  language,
  publisher,
  year,
  size = 'lg',
  action,
}: GameIdentityRowProps) {
  const hasMetadata = versionName || language || publisher || year;

  const nameElement = href ? (
    <a
      href={href}
      target={target}
      {...(target === '_blank' ? { rel: 'noopener noreferrer' } : {})}
      className="font-medium text-semantic-text-primary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom truncate block"
    >
      {name}
    </a>
  ) : (
    <p className="font-medium text-semantic-text-primary truncate">{name}</p>
  );

  return (
    <div className="flex items-center gap-4">
      <GameThumb src={thumbnail} alt={name} size={size} />
      <div className="flex-1 min-w-0">
        {nameElement}
        {hasMetadata && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-semantic-text-muted mt-0.5">
            {versionName && (
              <span className="flex items-center gap-1">
                <Tag size={13} className="shrink-0" />
                {versionName}
              </span>
            )}
            {language && (
              <span className="flex items-center gap-1">
                <Translate size={13} className="shrink-0" />
                {language}
              </span>
            )}
            {publisher && (
              <span className="flex items-center gap-1">
                <Buildings size={13} className="shrink-0" />
                {publisher}
              </span>
            )}
            {year && (
              <span className="flex items-center gap-1">
                <CalendarBlank size={13} className="shrink-0" />
                {year}
              </span>
            )}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export { GameIdentityRow };
export type { GameIdentityRowProps };
