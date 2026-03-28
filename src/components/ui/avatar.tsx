interface AvatarProps {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-8 h-8 text-xs rounded-md',
  md: 'w-10 h-10 text-sm rounded-lg',
};

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div
      className={`bg-snow-storm-light flex items-center justify-center text-semantic-text-muted font-medium ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
