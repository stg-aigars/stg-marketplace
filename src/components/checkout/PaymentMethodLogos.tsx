/* eslint-disable @next/next/no-img-element -- payment logos are external EveryPay URLs */
'use client';

import { useState, useEffect } from 'react';

interface PaymentMethod {
  source: string;
  display_name: string;
  logo_url: string;
}

// Module-level cache — payment methods don't change during a session
const methodsCache = new Map<string, PaymentMethod[]>();

interface PaymentMethodLogosProps {
  country: string;
}

export function PaymentMethodLogos({ country }: PaymentMethodLogosProps) {
  const cached = methodsCache.get(country);
  const [methods, setMethods] = useState<PaymentMethod[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (methodsCache.has(country)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from module-level cache
      setMethods(methodsCache.get(country)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/checkout/payment-methods?country=${encodeURIComponent(country)}`)
      .then((res) => res.json())
      .then((data: PaymentMethod[]) => {
        const result = Array.isArray(data) ? data : [];
        methodsCache.set(country, result);
        setMethods(result);
        setHiddenSources(new Set());
      })
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }, [country]);

  const visibleMethods = methods.filter((m) => !hiddenSources.has(m.source));

  if (!loading && visibleMethods.length === 0) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-12 rounded bg-semantic-bg-secondary animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="list"
      className="flex items-center justify-center gap-2 flex-wrap"
    >
      {visibleMethods.map((method) => (
        <div key={method.source} role="listitem">
          <img
            src={method.logo_url}
            alt={method.display_name}
            className="h-8 w-auto"
            onError={() =>
              setHiddenSources((prev) => new Set(prev).add(method.source))
            }
          />
        </div>
      ))}
    </div>
  );
}
