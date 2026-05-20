'use client';

import { type ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FeedbackModal } from './FeedbackModal';

interface FeedbackFooterButtonProps {
  className?: string;
  children?: ReactNode;
}

// Mount the modal only while it's open so the form remounts (and its state
// resets) every time the trigger is clicked again — avoids stale category /
// message / "thank-you" UI carrying across opens.
export function FeedbackFooterButton({ className, children }: FeedbackFooterButtonProps) {
  const t = useTranslations('Feedback');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? t('trigger')}
      </button>
      {open && <FeedbackModal open onClose={() => setOpen(false)} />}
    </>
  );
}
