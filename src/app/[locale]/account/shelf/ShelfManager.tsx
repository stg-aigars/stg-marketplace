'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, DownloadSimple } from '@phosphor-icons/react/ssr';
import { Button, EmptyState } from '@/components/ui';
import type { ShelfItemWithGame } from '@/lib/shelves/types';
import { ShelfItemCard } from './ShelfItemCard';
import { AddToShelfModal } from './AddToShelfModal';
import { EditShelfItemModal } from './EditShelfItemModal';
import { ImportFromBGG } from './ImportFromBGG';
import { useShelfEnrichment } from './useShelfEnrichment';

interface ShelfManagerProps {
  initialItems: ShelfItemWithGame[];
  bggUsername: string | null;
}

export function ShelfManager({ initialItems, bggUsername }: ShelfManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShelfItemWithGame | null>(null);

  useShelfEnrichment(items, setItems);

  function handleAdded(item: ShelfItemWithGame) {
    setItems((prev) => [item, ...prev]);
    setShowAddModal(false);
    router.refresh();
  }

  function handleUpdated(updated: ShelfItemWithGame) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
    router.refresh();
  }

  function handleRemoved(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
          My shelf
        </h1>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImportModal(true)}
            >
              <DownloadSimple size={16} className="mr-1.5" />
              Import from BGG
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus size={16} className="mr-1.5" />
              Add game
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Your shelf is empty"
          description="Add games from your collection to showcase what you have"
          action={{ label: 'Add your first game', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <ShelfItemCard
              key={item.id}
              item={item}
              onEdit={() => setEditingItem(item)}
              onRemoved={() => handleRemoved(item.id)}
            />
          ))}
        </div>
      )}

      <AddToShelfModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleAdded}
      />

      {editingItem && (
        <EditShelfItemModal
          item={editingItem}
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          onUpdated={handleUpdated}
        />
      )}

      <ImportFromBGG
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        savedUsername={bggUsername}
        onImported={() => {
          setShowImportModal(false);
          router.refresh();
        }}
      />
    </>
  );
}
