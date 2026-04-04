import Image from 'next/image';
import { Package } from '@phosphor-icons/react/ssr';
import { isBggImage } from '@/lib/bgg/utils';

interface GameThumbProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20 sm:w-24 sm:h-24',
} as const;

const sizePx = { sm: 40, md: 48, lg: 56, xl: 96 } as const;

function GameThumb({ src, alt, size = 'md', className = '' }: GameThumbProps) {
  const isBGG = isBggImage(src);
  const px = sizePx[size];

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-semantic-bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={px}
          height={px}
          className={`w-full h-full ${isBGG ? 'object-contain' : 'object-cover'}`}
          unoptimized={isBGG}
        />
      ) : (
        <Package size={20} className="text-semantic-text-muted" />
      )}
    </div>
  );
}

export { GameThumb };
export type { GameThumbProps };
