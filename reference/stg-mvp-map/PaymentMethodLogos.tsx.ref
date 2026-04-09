/* eslint-disable @next/next/no-img-element -- payment logos are external EveryPay URLs */
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface PaymentMethod {
  source: string;
  display_name: string;
  logo_url: string;
}

interface PaymentMethodLogosProps {
  country: string;
  compact?: boolean;
}

export function PaymentMethodLogos({ country, compact }: PaymentMethodLogosProps) {
  const t = useTranslations('Checkout');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/checkout/payment-methods?country=${encodeURIComponent(country)}`)
      .then((res) => res.json())
      .then((data: PaymentMethod[]) => {
        setMethods(Array.isArray(data) ? data : []);
        setHiddenSources(new Set());
      })
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }, [country]);

  const handleImageError = (source: string) => {
    setHiddenSources((prev) => new Set(prev).add(source));
  };

  const visibleMethods = methods.filter((m) => !hiddenSources.has(m.source));

  if (!loading && visibleMethods.length === 0) return null;

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`${compact ? 'h-5 w-10' : 'h-6 w-12'} rounded bg-bg-secondary animate-pulse`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'text-center'}>
      {!compact && (
        <p className="text-xs text-text-muted mb-2">{t('payment.weAccept')}</p>
      )}
      <div
        role="list"
        className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-2 flex-wrap'}`}
      >
        {visibleMethods.map((method) => (
          <div key={method.source} role="listitem">
            <img
              src={method.logo_url}
              alt={method.display_name}
              className={`${compact ? 'h-7' : 'h-10'} w-auto opacity-60 hover:opacity-100 transition-opacity`}
              onError={() => handleImageError(method.source)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
