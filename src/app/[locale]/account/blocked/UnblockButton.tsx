'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@/components/ui';
import { unblockUser } from '@/lib/messaging/actions';

interface UnblockButtonProps {
  targetId: string;
}

export function UnblockButton({ targetId }: UnblockButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await unblockUser(targetId);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Unblock
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Unblock this user?">
        <p className="text-sm text-semantic-text-secondary mb-4">
          They can message you and start new conversations again.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="brand" size="sm" onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Unblocking…' : 'Unblock'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
