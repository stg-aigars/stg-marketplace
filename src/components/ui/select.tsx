'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, options, placeholder, className, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-semantic-text-primary mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'block w-full min-h-[44px] rounded-lg border px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-input transition-all duration-250 ease-out-custom focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand',
            error ? 'border-semantic-error shadow-glow-error' : 'border-semantic-border-default',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-semantic-error">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
export type { SelectProps, SelectOption };
