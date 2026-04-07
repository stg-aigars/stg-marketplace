/* eslint-disable @next/next/no-img-element -- payment logos are external EveryPay URLs */
'use client';

import { useState, useEffect } from 'react';

interface PaymentMethod {
  source: string;
  display_name: string;
  logo_url: string;
}

interface PaymentMethodLogosProps {
  country: string;
}

export function PaymentMethodLogos({ country }: PaymentMethodLogosProps) {
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
