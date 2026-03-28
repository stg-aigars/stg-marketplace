import Image from 'next/image';
import { Package } from '@phosphor-icons/react/ssr';

interface GameThumbProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
} as const;

function GameThumb({ src, alt, size = 'md', className = '' }: GameThumbProps) {
  const isBGG = src?.includes('cf.geekdo-images.com');

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-semantic-bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={56}
          height={56}
          className={isBGG ? 'object-contain' : 'object-cover w-full h-full'}
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
