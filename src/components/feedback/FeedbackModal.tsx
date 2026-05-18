'use client';

import { Modal } from '@/components/ui';
import { FeedbackForm } from './FeedbackForm';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
}

export function FeedbackModal({ open, onClose, title }: FeedbackModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <FeedbackForm onClose={onClose} />
    </Modal>
  );
}
