'use client';

import { useState } from 'react';
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

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const sizeClass = sizeClasses[size];

  if (src && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small user-uploaded avatar with onError → initials fallback; next/image overhead not worth it
      <img
        src={src}
        alt={name}
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
