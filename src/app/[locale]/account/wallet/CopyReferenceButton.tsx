'use client';

import { useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';

interface CopyReferenceButtonProps {
  value: string;
  label?: string;
}

export function CopyReferenceButton({ value, label = 'Copy' }: CopyReferenceButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — silently fail
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} aria-label={`${label} ${value}`}>
      {copied ? <Check size={16} className="mr-1.5" /> : <Copy size={16} className="mr-1.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
