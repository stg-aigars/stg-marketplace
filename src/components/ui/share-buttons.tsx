'use client';

import { useState } from 'react';
import { LinkSimple, ShareNetwork } from '@phosphor-icons/react/ssr';
import { Button } from './button';

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const supportsShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: silently fail
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // User cancelled or share failed — silent
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={handleCopy}>
        <LinkSimple size={16} className="mr-1.5" />
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      {supportsShare && (
        <Button variant="ghost" size="sm" onClick={handleShare}>
          <ShareNetwork size={16} className="mr-1.5" />
          Share
        </Button>
      )}
    </div>
  );
}
