'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import { FeedbackForm } from './FeedbackForm';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const t = useTranslations('Feedback');
  return (
    <Modal open={open} onClose={onClose} title={t('modalTitle')}>
      <FeedbackForm onClose={onClose} />
    </Modal>
  );
}
