'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal } from '@/components/ui';
import { TurnstileWidget } from '@/components/ui/TurnstileWidget';
import { cancelListing } from '@/lib/listings/actions';

interface RemoveListingModalProps {
  listingId: string;
  open: boolean;
  onClose: () => void;
}

export function RemoveListingModal({ listingId, open, onClose }: RemoveListingModalProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Reset stale state when modal opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when modal opens
      setError(null);
      setRemoving(false);
    }
  }, [open]);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    const result = await cancelListing(listingId, turnstileToken ?? undefined);

    if ('error' in result) {
      setError(result.error);
      setRemoving(false);
      return;
    }

    onClose();
    router.refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Remove listing">
      <div className="space-y-4">
        <p className="text-semantic-text-secondary">
          This will remove your listing from the marketplace. This action cannot be undone.
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={removing}>
            Keep listing
          </Button>
          <Button variant="danger" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing...' : 'Remove'}
          </Button>
        </div>

        <TurnstileWidget onVerify={setTurnstileToken} />
      </div>
    </Modal>
  );
}
