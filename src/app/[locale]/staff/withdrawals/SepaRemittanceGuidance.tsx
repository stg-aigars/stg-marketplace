'use client';

import { useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';

interface SepaRemittanceGuidanceProps {
  reference: string;
}

// Europe/Riga matches the year boundary used by issue_withdrawal_reference in
// migration 078 — the remittance date stays tied to the Latvian business day
// regardless of where the staff member's browser is.
const RIGA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Riga',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function todayIsoDate(): string {
  return RIGA_DATE_FORMATTER.format(new Date());
}

export function SepaRemittanceGuidance({ reference }: SepaRemittanceGuidanceProps) {
  const [copied, setCopied] = useState<'ref' | 'full' | null>(null);
  const remittance = `STG ${reference} ${todayIsoDate()}`;

  async function copy(value: string, kind: 'ref' | 'full') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((prev) => (prev === kind ? null : prev)), 2000);
    } catch {
      // Clipboard blocked — silently fail
    }
  }

  return (
    <div className="mt-3 border border-semantic-border rounded-md p-3 bg-semantic-surface-muted">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs text-semantic-text-muted">Reference</p>
          <code className="text-sm font-semibold text-semantic-text-heading">{reference}</code>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copy(reference, 'ref')}
          aria-label={`Copy reference ${reference}`}
        >
          {copied === 'ref' ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
          {copied === 'ref' ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <p className="text-xs text-semantic-text-muted">
        When executing this SEPA transfer from the Swedbank business portal, put
        this in the remittance field (date = today when the transfer is executed):
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <code className="text-sm font-semibold text-semantic-text-heading truncate">
          {remittance}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copy(remittance, 'full')}
          aria-label={`Copy remittance string ${remittance}`}
        >
          {copied === 'full' ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
          {copied === 'full' ? 'Copied' : 'Copy remittance'}
        </Button>
      </div>
    </div>
  );
}
