'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** Size variant — sm for compact desktop, md for touch targets */
  size?: 'sm' | 'md';
}

function Toggle({ checked, onChange, label, size = 'md' }: ToggleProps) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${size === 'sm' ? 'min-h-[32px]' : 'min-h-[44px] sm:min-h-[32px]'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-250 ease-out-custom ${
          checked ? 'bg-semantic-brand' : 'bg-semantic-border-default'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-semantic-bg-elevated shadow-sm transform transition-transform duration-250 ease-out-custom mt-0.5 ${
            checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      {label && <span className="text-xs text-semantic-text-secondary whitespace-nowrap">{label}</span>}
    </label>
  );
}

export { Toggle };
export type { ToggleProps };
