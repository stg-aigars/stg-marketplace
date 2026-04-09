'use client';

import { useState } from 'react';
import { Button, Alert } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';

interface Dac7StaffActionsProps {
  year: number;
  hasReports: boolean;
}

export function Dac7StaffActions({ year, hasReports }: Dac7StaffActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: 'generate' | 'notify' | 'submit' | 'download') {
    if (action === 'download') {
      window.open(`/api/staff/dac7/report?year=${year}&format=xml`, '_blank');
      return;
    }

    setLoading(action);
    setResult(null);
    setError(null);

    const endpoints: Record<string, string> = {
      generate: '/api/staff/dac7/report',
      notify: '/api/staff/dac7/notify',
      submit: '/api/staff/dac7/submit',
    };

    try {
      const res = await apiFetch(endpoints[action], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Request failed');
        return;
      }

      if (action === 'generate') {
        setResult(`Generated: ${data.complete} complete, ${data.incomplete} incomplete`);
      } else if (action === 'notify') {
        setResult(`Notified ${data.notified} sellers`);
      } else if (action === 'submit') {
        setResult(`Marked ${data.marked} reports as submitted`);
      }
    } catch {
      setError('Request failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {result && <Alert variant="success">{result}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={loading === 'generate'}
          disabled={!!loading}
          onClick={() => handleAction('generate')}
        >
          Generate reports for {year}
        </Button>

        {hasReports && (
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={loading === 'notify'}
              disabled={!!loading}
              onClick={() => handleAction('notify')}
            >
              Notify sellers
            </Button>

            <Button
              variant="secondary"
              size="sm"
              disabled={!!loading}
              onClick={() => handleAction('download')}
            >
              Download XML
            </Button>

            <Button
              variant="ghost"
              size="sm"
              loading={loading === 'submit'}
              disabled={!!loading}
              onClick={() => handleAction('submit')}
            >
              Mark as submitted to VID
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
