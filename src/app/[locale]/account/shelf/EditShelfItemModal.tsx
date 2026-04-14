'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Select, Textarea } from '@/components/ui';
import { updateShelfItem } from '@/lib/shelves/actions';
import type { ShelfItemWithGame, ShelfVisibility } from '@/lib/shelves/types';
import { MAX_NOTE_LENGTH, SHELF_VISIBILITY_OPTIONS } from '@/lib/shelves/types';

interface EditShelfItemModalProps {
  item: ShelfItemWithGame;
  open: boolean;
  onClose: () => void;
  onUpdated: (item: ShelfItemWithGame) => void;
}

export function EditShelfItemModal({ item, open, onClose, onUpdated }: EditShelfItemModalProps) {
  const [visibility, setVisibility] = useState<ShelfVisibility>(item.visibility);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync when item changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when modal item changes
    setVisibility(item.visibility === 'listed' ? 'open_to_offers' : item.visibility);
    setNotes(item.notes ?? '');
    setError('');
  }, [item]);

  async function handleSubmit() {
    setSaving(true);
    setError('');

    const result = await updateShelfItem(item.id, visibility, notes || null);

    if ('error' in result) {
      setError(result.error);
      setSaving(false);
      return;
    }

    onUpdated({
      ...item,
      visibility,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit shelf item">
      <div className="space-y-4 pb-4">
        <div>
          <p className="text-sm font-medium text-semantic-text-primary mb-1.5">Game</p>
          <p className="text-sm text-semantic-text-secondary">
            {item.game_name}
            {item.game_year ? ` (${item.game_year})` : ''}
          </p>
        </div>

        <Select
          label="Visibility"
          options={SHELF_VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ShelfVisibility)}
        />

        <div>
          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Condition details, language, edition..."
          />
          <p className="mt-1 text-xs text-semantic-text-muted text-right">
            {notes.length}/{MAX_NOTE_LENGTH}
          </p>
        </div>

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
