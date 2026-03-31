'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CaretDown } from '@phosphor-icons/react/ssr';
import {
  detectPhoneCountry,
  composePhoneNumber,
  PHONE_COUNTRY_CONFIGS,
  type PhoneCountryCode,
} from '@/lib/phone-utils';
import { getCountryFlag, COUNTRIES, type CountryCode } from '@/lib/country-utils';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (fullNumber: string) => void;
  defaultCountry: CountryCode;
  error?: string;
  id?: string;
}

function resolveInitialState(value: string, defaultCountry: CountryCode) {
  if (!value) {
    return { country: defaultCountry, localNumber: '' };
  }
  const parsed = detectPhoneCountry(value);
  // Non-Baltic number already saved — don't grandfather it in
  if (parsed.country === 'OTHER') {
    return { country: defaultCountry, localNumber: '' };
  }
  return { country: parsed.country as CountryCode, localNumber: parsed.localNumber };
}

function PhoneInput({ label, value, onChange, defaultCountry, error, id }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    () => resolveInitialState(value, defaultCountry).country
  );
  const [localNumber, setLocalNumber] = useState(
    () => resolveInitialState(value, defaultCountry).localNumber
  );
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = PHONE_COUNTRY_CONFIGS.find(c => c.code === selectedCountry);
  const flagClass = getCountryFlag(selectedCountry);

  // Dismiss dropdown on click outside, Escape, or tab away
  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    function handleFocusOut(e: FocusEvent) {
      // Close if focus moves outside wrapper entirely
      if (wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    wrapperRef.current?.addEventListener('focusout', handleFocusOut);
    const wrapper = wrapperRef.current;

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      wrapper?.removeEventListener('focusout', handleFocusOut);
    };
  }, [open]);

  const handleCountryChange = useCallback((country: CountryCode) => {
    setSelectedCountry(country);
    setOpen(false);
    // Keep local number if it looks compatible, otherwise clear
    const newConfig = PHONE_COUNTRY_CONFIGS.find(c => c.code === country);
    const expectedLength = newConfig?.localPlaceholder.length ?? 0;
    const keepLocal = localNumber.length > 0 && localNumber.length <= expectedLength;
    const newLocal = keepLocal ? localNumber : '';
    setLocalNumber(newLocal);
    onChange(composePhoneNumber(country, newLocal));
    inputRef.current?.focus();
  }, [localNumber, onChange]);

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    setLocalNumber(digits);
    onChange(composePhoneNumber(selectedCountry, digits));
  }

  const borderClass = error
    ? 'border-semantic-error shadow-glow-error'
    : focused
      ? 'border-semantic-brand ring-2 ring-semantic-brand/20'
      : 'border-semantic-border-default';

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-semantic-text-primary mb-1.5">
          {label}
        </label>
      )}
      <div ref={wrapperRef} className="relative">
        <div className={`flex rounded-lg border ${borderClass} transition-all duration-250 ease-out-custom bg-semantic-bg-input overflow-visible`}>
          {/* Country selector button */}
          <button
            type="button"
            onClick={() => setOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-3 min-h-[44px] border-r border-semantic-border-default bg-semantic-bg-subtle rounded-l-lg shrink-0 text-base sm:text-sm text-semantic-text-primary sm:hover:bg-semantic-bg-subtle/80 transition-colors duration-250 ease-out-custom"
            tabIndex={-1}
            aria-label="Select country code"
            aria-expanded={open}
          >
            {flagClass && <span className={`${flagClass}`} />}
            <span className="font-medium">{config?.prefix}</span>
            <CaretDown size={14} weight="bold" className="text-semantic-text-muted" />
          </button>

          {/* Local number input */}
          <input
            ref={inputRef}
            id={id}
            type="tel"
            inputMode="numeric"
            value={localNumber}
            onChange={handleLocalChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={config?.localPlaceholder}
            className="flex-1 min-h-[44px] px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-transparent placeholder:text-semantic-text-muted placeholder:opacity-50 focus:outline-none rounded-r-lg"
          />
        </div>

        {/* Country dropdown */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full mt-1 z-10 w-56 bg-semantic-bg-primary border border-semantic-border-default rounded-lg shadow-lg py-1"
            role="listbox"
            aria-label="Country code"
          >
            {COUNTRIES.map(country => {
              const countryConfig = PHONE_COUNTRY_CONFIGS.find(c => c.code === country.code);
              const isSelected = country.code === selectedCountry;
              return (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleCountryChange(country.code)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-left transition-colors duration-250 ease-out-custom ${
                    isSelected
                      ? 'bg-semantic-bg-subtle text-semantic-text-primary'
                      : 'text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle'
                  }`}
                >
                  <span className={country.flagClass} />
                  <span className="font-medium">{countryConfig?.prefix}</span>
                  <span>{country.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-semantic-error">{error}</p>}
    </div>
  );
}

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
export type { PhoneInputProps };
