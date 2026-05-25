'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DotsThreeVertical } from '@phosphor-icons/react/ssr';
import { Button, Modal } from '@/components/ui';
import { blockUser } from '@/lib/messaging/actions';

interface ThreadMenuProps {
  counterpartyId: string;
  counterpartyName: string;
}

export function ThreadMenu({ counterpartyId, counterpartyName }: ThreadMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleBlockClick() {
    setMenuOpen(false);
    setConfirmOpen(true);
  }

  function handleConfirmBlock() {
    startTransition(async () => {
      await blockUser(counterpartyId);
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-2 rounded-md text-semantic-text-muted sm:hover:text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          <DotsThreeVertical size={20} weight="bold" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 mt-1 w-44 rounded-md border border-semantic-border-default bg-semantic-bg-elevated shadow-lg z-20 py-1">
              <button
                type="button"
                onClick={handleBlockClick}
                className="w-full text-left px-3 py-2 text-sm text-semantic-text-primary sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
              >
                Block this user
              </button>
            </div>
          </>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Block ${counterpartyName}?`}
      >
        <p className="text-sm text-semantic-text-secondary mb-4">
          Neither of you will be able to send messages in this or any other conversation.
          You can unblock at any time from your blocked users list.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmBlock}
            disabled={isPending}
          >
            {isPending ? 'Blocking…' : 'Block'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
