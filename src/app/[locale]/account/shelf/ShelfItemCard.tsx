'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { DotsThreeVertical, PencilSimple, Trash, ImageSquare } from '@phosphor-icons/react/ssr';
import { isBggImage } from '@/lib/bgg/utils';
import { Card, Badge, Button, Modal } from '@/components/ui';
import { GameTitle, GameMeta } from '@/components/listings/atoms';
import type { ShelfItemWithGame } from '@/lib/shelves/types';
import { SHELF_VISIBILITY_LABELS, SHELF_VISIBILITY_BADGE_VARIANT } from '@/lib/shelves/types';
import { removeFromShelf } from '@/lib/shelves/actions';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useEscapeKey } from '@/hooks/useEscapeKey';

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
  const badgeVariant = SHELF_VISIBILITY_BADGE_VARIANT[item.visibility];
  const badgeLabel = SHELF_VISIBILITY_LABELS[item.visibility];

  useClickOutside(() => setMenuOpen(false), menuOpen, menuRef);
  useEscapeKey(() => setMenuOpen(false), menuOpen);

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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm active:bg-semantic-bg-overlay sm:hover:bg-semantic-bg-overlay transition-colors duration-250 ease-out-custom"
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
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-text-primary hover:bg-semantic-bg-surface transition-colors duration-250 ease-out-custom"
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
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-semantic-error hover:bg-semantic-bg-surface transition-colors duration-250 ease-out-custom"
              >
                <Trash size={16} />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Image — square */}
        <div className="aspect-square bg-semantic-bg-secondary flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.game_name}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized={isBggImage(imageUrl)}
            />
          ) : (
            <ImageSquare size={48} className="text-semantic-text-muted" />
          )}
        </div>

        {/* Details */}
        <div className="px-3 py-3 space-y-2">
          <div>
            <GameTitle name={item.game_name} clamp={2} />
            <GameMeta year={item.game_year} className="mt-0.5" />
          </div>

          <Badge variant={badgeVariant}>{badgeLabel}</Badge>

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
