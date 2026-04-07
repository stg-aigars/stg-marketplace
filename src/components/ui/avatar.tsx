'use client';

import { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px] rounded',
  sm: 'w-8 h-8 text-xs rounded-md',
  md: 'w-10 h-10 text-sm rounded-lg',
};

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  const classes = sizeClasses[size];

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={`${classes} object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`bg-semantic-bg-secondary flex items-center justify-center text-semantic-text-muted font-medium ${classes} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
