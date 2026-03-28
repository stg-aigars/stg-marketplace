'use client';

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react/ssr';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', type, prefix, suffix, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const hasLeft = !!prefix;
    const hasRight = isPassword || !!suffix;

    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-semantic-text-primary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-muted text-base sm:text-sm pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type={inputType}
            className={`block w-full min-h-[44px] rounded-lg border px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-input placeholder:text-semantic-text-muted transition-all duration-250 ease-out-custom focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand ${hasLeft ? 'pl-8' : ''} ${hasRight ? 'pr-11' : ''} ${error ? 'border-semantic-error shadow-glow-error' : 'border-semantic-border-default'} ${className}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-semantic-text-muted sm:hover:text-semantic-text-secondary"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeSlash size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          )}
          {suffix && !isPassword && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-semantic-text-muted text-base sm:text-sm pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-semantic-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export type { InputProps };
