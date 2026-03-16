import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-semantic-primary text-semantic-text-inverse active:bg-semantic-primary-active sm:hover:bg-semantic-primary-hover disabled:opacity-50',
  secondary:
    'bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-default active:bg-snow-storm-light sm:hover:shadow-md disabled:opacity-50',
  ghost:
    'text-semantic-text-secondary active:bg-snow-storm-light sm:hover:bg-snow-storm-light disabled:opacity-50',
  danger:
    'bg-semantic-error text-semantic-text-inverse active:bg-semantic-error-hover sm:hover:bg-semantic-error-hover disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 py-2 text-sm rounded-md',
  md: 'min-h-[44px] px-4 py-2.5 text-sm rounded-lg',
  lg: 'min-h-[48px] px-6 py-3 text-base rounded-lg w-full sm:w-auto',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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
