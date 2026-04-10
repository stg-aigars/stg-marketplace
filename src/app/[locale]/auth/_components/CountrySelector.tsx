'use client';

import { COUNTRIES, type CountryCode } from '@/lib/country-utils';

interface CountrySelectorProps {
  value: CountryCode | '';
  onChange: (code: CountryCode) => void;
}

const FLAG_EMOJI: Record<CountryCode, string> = {
  LV: '🇱🇻',
  EE: '🇪🇪',
  LT: '🇱🇹',
};

export function CountrySelector({ value, onChange }: CountrySelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-semantic-text-primary mb-1.5">
        Your country
      </label>
      <div className="grid grid-cols-3 gap-2">
        {COUNTRIES.map((country) => {
          const isSelected = value === country.code;
          return (
            <button
              key={country.code}
              type="button"
              onClick={() => onChange(country.code)}
              className={`flex flex-col items-center gap-1 rounded-lg py-3 px-2 text-sm font-medium transition-colors duration-250 ease-out-custom min-h-[44px] ${
                isSelected
                  ? 'border-2 border-semantic-brand bg-semantic-brand/5 text-semantic-text-primary'
                  : 'border border-semantic-border-subtle bg-semantic-bg-elevated text-semantic-text-secondary sm:hover:border-semantic-border-default'
              }`}
            >
              <span className="text-xl leading-none">{FLAG_EMOJI[country.code]}</span>
              <span>{country.name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-semantic-text-muted">
        We currently serve the Baltic states
      </p>
    </div>
  );
}
