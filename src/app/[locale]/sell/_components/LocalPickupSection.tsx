'use client';

import { Checkbox, Textarea } from '@/components/ui';
import { MAX_TEXT_FIELD_LENGTH } from '@/lib/listings/types';

export interface LocalPickupSectionProps {
  available: boolean;
  note: string;
  onAvailableChange: (available: boolean) => void;
  onNoteChange: (note: string) => void;
  /** Hide the internal divider + heading so a parent can render its own (e.g. a card heading). */
  hideHeading?: boolean;
}

export function LocalPickupSection({
  available,
  note,
  onAvailableChange,
  onNoteChange,
  hideHeading,
}: LocalPickupSectionProps) {
  return (
    <div className="space-y-3">
      {!hideHeading && (
        <>
          <hr className="border-semantic-border-subtle" />

          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Local pickup
          </p>
        </>
      )}

      <Checkbox checked={available} onChange={onAvailableChange}>
        I&apos;m open to arranging in-person pickup instead of shipping
      </Checkbox>

      {available && (
        <div>
          <Textarea
            id="local-pickup-note"
            value={note}
            onChange={(e) => {
              if (e.target.value.length <= MAX_TEXT_FIELD_LENGTH) {
                onNoteChange(e.target.value);
              }
            }}
            placeholder={`e.g. a neighborhood, or "happy to meet near the old town"`}
            rows={2}
          />
          <p className="text-xs text-semantic-text-muted text-right mt-1">
            {note.length}/{MAX_TEXT_FIELD_LENGTH}
          </p>
        </div>
      )}
    </div>
  );
}
