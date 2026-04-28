import { forwardRef, isValidElement, cloneElement, type ButtonHTMLAttributes, type ReactElement } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Render styling on the child element instead of wrapping in a <button>.
   *  Use with <Link> to avoid nested interactive elements (<a> inside <button>). */
  asChild?: boolean;
}

// 80ms press timing is a deliberate exception to the branded 250ms easing —
// 250ms feels sluggish once the finger has already left the button. Ghost
// variant opts out of the whole brutalist treatment; it's used in low-emphasis
// spots where the heavy chrome would be wrong.
const neoBrutalistPress = [
  'border-2 border-polar-night shadow-pop',
  'transition-[transform,box-shadow] duration-[80ms] ease-out',
  'sm:hover:-translate-x-px sm:hover:-translate-y-px sm:hover:shadow-pop-lg',
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-pop-sm',
  // disabled: + hover: combine in Tailwind, so the hover translates need explicit reset.
  'disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0',
  'disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none',
].join(' ');

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    `bg-semantic-primary text-semantic-text-primary-ink ${neoBrutalistPress} active:bg-semantic-primary-active sm:hover:bg-semantic-primary-hover`,
  brand:
    `bg-semantic-brand text-semantic-text-inverse ${neoBrutalistPress} active:bg-semantic-brand-active sm:hover:bg-semantic-brand-hover`,
  secondary:
    `bg-semantic-bg-elevated text-semantic-text-primary ${neoBrutalistPress} active:bg-semantic-bg-secondary sm:hover:bg-semantic-bg-secondary`,
  ghost:
    'text-semantic-text-secondary transition-colors duration-250 ease-out-custom active:bg-semantic-bg-secondary sm:hover:bg-semantic-bg-secondary',
  danger:
    `bg-semantic-error text-semantic-text-inverse ${neoBrutalistPress} active:bg-semantic-error-hover sm:hover:bg-semantic-error-hover`,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 py-2 text-sm rounded-md',
  md: 'min-h-[44px] px-4 py-2.5 text-sm rounded-lg',
  lg: 'min-h-[48px] px-6 py-3 text-base rounded-lg w-full sm:w-auto',
};

const baseClasses = 'inline-flex items-center justify-center font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50';

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, asChild, ...props }, ref) => {
    const classes = cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, {
        className: cn(classes, (children.props as { className?: string }).className),
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size="sm" className="mr-2" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
