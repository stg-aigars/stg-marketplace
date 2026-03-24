'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { DotsThreeVertical, PencilSimple, Trash, ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, Badge, Button, Modal } from '@/components/ui';
import type { ShelfItemWithGame, ShelfVisibility } from '@/lib/shelves/types';
import { removeFromShelf } from '@/lib/shelves/actions';

const visibilityBadge: Record<ShelfVisibility, { variant: 'default' | 'success' | 'trust'; label: string }> = {
  not_for_sale: { variant: 'default', label: 'Not for sale' },
  open_to_offers: { variant: 'success', label: 'Open to offers' },
  listed: { variant: 'trust', label: 'Listed' },
};

interface ShelfItemCardProps {
  item: ShelfItemWithGame;
  onEdit: () => void;
  onRemoved: () => void;
}

export function ShelfItemCard({ item, onEdit, onRemoved }: ShelfItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const imageUrl = item.image || item.thumbnail;
  const badge = visibilityBadge[item.visibility];

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  async function handleRemove() {
    setRemoving(true);
    setRemoveError(null);
    const result = await removeFromShelf(item.id);
    if ('success' in result) {
      setShowConfirm(false);
      onRemoved();
    } else {
      setRemoveError(result.error);
    }
    setRemoving(false);
  }

  return (
    <>
      <Card className="overflow-hidden relative">
        {/* Overflow menu */}
        <div ref={menuRef} className="absolute top-2 right-2 z-10">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm active:bg-semantic-bg-overlay sm:hover:bg-semantic-bg-overlay transition-colors"
            aria-label="Shelf item actions"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-text-primary hover:bg-semantic-bg-surface transition-colors"
              >
                <PencilSimple size={16} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
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

        {/* Image */}
        <div className="h-40 sm:h-44 lg:h-48 bg-snow-storm-light flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.game_name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized={imageUrl.includes('cf.geekdo-images.com')}
            />
          ) : (
            <ImageSquare size={48} className="text-semantic-text-muted" />
          )}
        </div>

        {/* Details */}
        <div className="px-3 py-3 space-y-2">
          <div>
            <h3 className="font-medium text-semantic-text-heading text-sm leading-tight line-clamp-2">
              {item.game_name}
            </h3>
            {item.game_year && (
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {item.game_year}
              </p>
            )}
          </div>

          <Badge variant={badge.variant}>{badge.label}</Badge>

          {item.notes && (
            <p className="text-xs text-semantic-text-muted line-clamp-2">
              {item.notes}
            </p>
          )}
        </div>
      </Card>

      {/* Remove confirmation modal */}
      <Modal open={showConfirm} onClose={() => { setShowConfirm(false); setRemoveError(null); }} title="Remove from shelf">
        <p className="text-sm text-semantic-text-secondary mb-4">
          Remove <span className="font-medium text-semantic-text-primary">{item.game_name}</span> from your shelf? This cannot be undone.
        </p>
        {removeError && (
          <p className="text-sm text-semantic-error mb-4">{removeError}</p>
        )}
        <div className="flex justify-end gap-3 pb-4">
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing...' : 'Remove'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
