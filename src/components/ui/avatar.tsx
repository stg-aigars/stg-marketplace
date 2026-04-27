'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'nav' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px] rounded',
  sm: 'w-8 h-8 text-xs rounded-md',
  nav: 'w-7 h-7 text-xs rounded-md',
  md: 'w-10 h-10 text-sm rounded-lg',
  lg: 'w-16 h-16 text-xl rounded-xl',
};

// Pixel sizes match sizeClasses Tailwind units (1 = 4px). Used as the
// next/image `width`/`height`/`sizes` so /_next/image generates 1x and 2x
// variants of the right dimensions instead of always shipping the 256×256
// upload-route source for a 20px display slot.
const sizePixels: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 20,
  sm: 32,
  nav: 28,
  md: 40,
  lg: 64,
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const sizeClass = sizeClasses[size];

  if (src && !imgError) {
    const px = sizePixels[size];
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        sizes={`${px}px`}
        onError={() => setImgError(true)}
        className={cn(sizeClass, 'object-cover', className)}
      />
    );
  }

  return (
    <div
      className={cn('bg-semantic-bg-secondary flex items-center justify-center text-semantic-text-muted font-medium', sizeClass, className)}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
