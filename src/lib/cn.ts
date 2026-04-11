import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind utility classes with conflict resolution.
 * Use in shared UI components so caller-supplied `className` overrides
 * win against the component's own size/variant classes, regardless of
 * CSS cascade order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
