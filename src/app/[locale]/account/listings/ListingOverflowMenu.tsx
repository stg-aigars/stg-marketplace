'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react/ssr';
import { Alert, Button, Modal } from '@/components/ui';
import { TurnstileWidget } from '@/components/ui/TurnstileWidget';
import { cancelListing } from '@/lib/listings/actions';

interface ListingOverflowMenuProps {
  listingId: string;
}

export function ListingOverflowMenu({ listingId }: ListingOverflowMenuProps) {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

    setShowConfirm(false);
    router.refresh();
  };

  return (
    <>
      <div ref={menuRef} className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
          }}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm active:bg-semantic-bg-overlay sm:hover:bg-semantic-bg-overlay transition-colors"
          aria-label="Listing actions"
        >
          <DotsThreeVertical size={18} weight="bold" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg overflow-hidden">
            <Link
              href={`/${locale}/listings/${listingId}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-text-primary hover:bg-semantic-bg-surface transition-colors"
            >
              <PencilSimple size={16} />
              Edit
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setShowConfirm(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-error hover:bg-semantic-bg-surface transition-colors"
            >
              <Trash size={16} />
              Remove
            </button>
          </div>
        )}
      </div>

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Remove listing"
      >
        <div className="space-y-4">
          <p className="text-semantic-text-secondary">
            This will remove your listing from the marketplace. This action cannot be undone.
          </p>

          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              disabled={removing}
            >
              Keep listing
            </Button>
            <Button
              variant="danger"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </div>

          <TurnstileWidget onVerify={setTurnstileToken} />
        </div>
      </Modal>
    </>
  );
}
