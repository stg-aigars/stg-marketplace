'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api-fetch';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, X, CloudArrowUp } from '@phosphor-icons/react/ssr';
import { Spinner } from '@/components/ui';
import { MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';

interface PhotoUploadStepProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  compact?: boolean;
  heading?: string | null;
  requiredMin?: number;
}

function SortablePhoto({
  url,
  index,
  total,
  sortId,
  onRemove,
}: {
  url: string;
  index: number;
  total: number;
  sortId: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group aspect-square ${isDragging ? 'z-10 opacity-75' : ''}`}
    >
      <Image
        src={url}
        alt={`Photo ${index + 1}`}
        fill
        sizes="(min-width: 640px) 25vw, 50vw"
        className="object-cover rounded-lg border border-semantic-border-subtle"
      />
      {/* Drag handle overlay */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 rounded-lg cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus"
        aria-label={`Drag to reorder photo ${index + 1} of ${total}`}
        aria-roledescription="sortable"
      />
      {/* Drag handle icon */}
      <div className="absolute top-1.5 left-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm pointer-events-none sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-250 ease-out-custom">
        <DotsSixVertical size={16} />
      </div>
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm active:bg-semantic-bg-overlay sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-250 ease-out-custom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus"
        aria-label={`Remove photo ${index + 1}`}
      >
        <X size={16} />
      </button>
      {/* Cover badge */}
      {index === 0 && (
        <span className="absolute bottom-1.5 left-1.5 text-xs bg-semantic-bg-overlay/80 text-semantic-text-inverse px-2 py-0.5 rounded-full backdrop-blur-sm">
          Cover
        </span>
      )}
    </div>
  );
}

export function PhotoUploadStep({ photos, onPhotosChange, compact, heading, requiredMin }: PhotoUploadStepProps) {
  const [uploading, setUploading] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortIds = photos.map((url, i) => `${i}-${url}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortIds.indexOf(active.id as string);
    const newIndex = sortIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...photos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onPhotosChange(reordered);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setError(null);

    // Check how many we can still add
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    const filesToUpload = files.slice(0, remaining);

    // Validate each file
    for (const file of filesToUpload) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        setError('Only JPEG, PNG, WebP, and AVIF images are supported');
        return;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setError('Each photo must be under 10MB');
        return;
      }
    }

    // Upload files sequentially — continue on failure so partial batches succeed
    setUploading(filesToUpload.length);
    const newUrls: string[] = [];
    const failedNames: string[] = [];

    for (const file of filesToUpload) {
      try {
        const body = new FormData();
        body.append('file', file);

        const res = await apiFetch('/api/listings/photos', {
          method: 'POST',
          body,
        });

        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.url);
        } else {
          failedNames.push(file.name);
        }
      } catch {
        failedNames.push(file.name);
      }
      setUploading((prev) => Math.max(0, prev - 1));
    }

    if (failedNames.length > 0) {
      const uploaded = filesToUpload.length - failedNames.length;
      if (uploaded > 0) {
        setError(`${uploaded} of ${filesToUpload.length} photos uploaded. Failed: ${failedNames.join(', ')}`);
      } else {
        setError('Failed to upload photos. Please try again.');
      }
    }

    if (newUrls.length > 0) {
      onPhotosChange([...photos, ...newUrls]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {compact ? (
        heading !== null && <h2 className="text-base font-semibold text-semantic-text-heading">{heading ?? 'Photos'}</h2>
      ) : (
        <>
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Add photos
          </h2>
          <p className="text-sm text-semantic-text-secondary">
            Show buyers what your copy looks like. Include the box, components, and any wear.
          </p>
        </>
      )}

      {/* Photo count / requirement */}
      <p className="text-sm text-semantic-text-muted">
        {requiredMin != null && photos.length < requiredMin
          ? `At least ${requiredMin} photo needed`
          : `${photos.length}/${MAX_PHOTOS} photos${photos.length > 1 ? ' — drag to reorder' : ''}`
        }
      </p>

      {/* Upload area — custom styled button needed for dropzone layout; Button component doesn't support this */}
      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading > 0}
          className="w-full min-h-[120px] border-[1.5px] border-dashed border-semantic-border-default bg-semantic-bg-secondary rounded-xl flex flex-col items-center justify-center gap-2 text-semantic-text-muted active:border-semantic-brand sm:hover:border-semantic-brand transition-colors duration-250 ease-out-custom disabled:opacity-50"
        >
          {uploading > 0 ? (
            <>
              <Spinner size="lg" />
              <span className="text-sm">
                Uploading... {uploading} remaining
              </span>
            </>
          ) : (
            <>
              <CloudArrowUp size={36} className="text-semantic-brand" />
              <span className="text-sm">Upload photos</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <p className="text-sm text-semantic-error">{error}</p>
      )}

      {/* Photo grid with drag-and-drop reorder */}
      {photos.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {photos.map((url, index) => (
                <SortablePhoto
                  key={sortIds[index]}
                  url={url}
                  index={index}
                  total={photos.length}
                  sortId={sortIds[index]}
                  onRemove={() => handleRemove(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Nudge when no photos — hidden in compact mode where parent provides messaging */}
      {photos.length === 0 && !compact && (
        <p className="text-sm text-semantic-text-muted text-center">
          Listings with photos get more attention from buyers
        </p>
      )}
    </div>
  );
}
