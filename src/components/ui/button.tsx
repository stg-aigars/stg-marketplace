import { forwardRef, isValidElement, cloneElement, type ButtonHTMLAttributes, type ReactElement } from 'react';
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

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-semantic-primary text-semantic-text-inverse shadow-glow-primary active:bg-semantic-primary-active active:shadow-sm sm:hover:bg-semantic-primary-hover',
  brand:
    'bg-semantic-brand text-semantic-text-inverse shadow-sm active:bg-semantic-brand-active active:shadow-sm sm:hover:bg-semantic-brand-hover',
  secondary:
    'bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-default active:bg-semantic-bg-secondary active:shadow-sm sm:hover:shadow-md sm:hover:border-semantic-brand',
  ghost:
    'text-semantic-text-secondary active:bg-semantic-bg-secondary sm:hover:bg-semantic-bg-secondary',
  danger:
    'bg-semantic-error text-semantic-text-inverse active:bg-semantic-error-hover active:shadow-sm sm:hover:bg-semantic-error-hover',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 py-2 text-sm rounded-md',
  md: 'min-h-[44px] px-4 py-2.5 text-sm rounded-lg',
  lg: 'min-h-[48px] px-6 py-3 text-base rounded-lg w-full sm:w-auto',
};

const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-250 ease-out-custom active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50';

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, asChild, ...props }, ref) => {
    const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<Record<string, unknown>>, {
        className: `${classes} ${(children.props as { className?: string }).className ?? ''}`.trim(),
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
