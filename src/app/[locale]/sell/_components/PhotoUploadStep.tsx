'use client';

import { useState, useRef } from 'react';
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
import { MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_TYPES } from '@/lib/listings/types';

interface PhotoUploadStepProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
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
      <img
        src={url}
        alt={`Photo ${index + 1}`}
        className="w-full h-full object-cover rounded-lg border border-semantic-border-subtle"
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
      <div className="absolute top-1.5 left-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm pointer-events-none sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </div>
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-full bg-semantic-bg-overlay/80 text-semantic-text-inverse backdrop-blur-sm active:bg-semantic-bg-overlay sm:opacity-0 sm:group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus"
        aria-label={`Remove photo ${index + 1}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
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

export function PhotoUploadStep({ photos, onPhotosChange }: PhotoUploadStepProps) {
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

    // Upload files sequentially
    setUploading(filesToUpload.length);
    const newUrls: string[] = [];

    try {
      for (const file of filesToUpload) {
        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch('/api/listings/photos', {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            newUrls.push(data.url);
          } else {
            setError('Failed to upload photo. Please try again.');
            break;
          }
        } catch {
          setError('Failed to upload photo. Please try again.');
          break;
        }
      }
    } finally {
      setUploading(0);
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
      <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
        Add photos
      </h2>
      <p className="text-sm text-semantic-text-secondary">
        Show buyers what your copy looks like. Include the box, components, and any wear.
      </p>

      {/* Photo count */}
      <p className="text-sm text-semantic-text-muted">
        {photos.length}/{MAX_PHOTOS} photos
        {photos.length > 1 && ' — drag to reorder'}
      </p>

      {/* Upload area — custom styled button needed for dropzone layout; Button component doesn't support this */}
      {photos.length < MAX_PHOTOS && (
        // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading > 0}
          className="w-full min-h-[120px] border border-dashed border-semantic-border-default rounded-lg flex flex-col items-center justify-center gap-2 text-semantic-text-muted active:border-semantic-primary sm:hover:border-semantic-primary transition-colors disabled:opacity-50"
        >
          {uploading > 0 ? (
            <>
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">
                Uploading {uploading} {uploading === 1 ? 'photo' : 'photos'}...
              </span>
            </>
          ) : (
            <>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.57 4.845A4.5 4.5 0 0118 19.5H6.75z" />
              </svg>
              <span className="text-sm">Tap to upload photos</span>
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

      {/* Minimum photo reminder */}
      {photos.length === 0 && (
        <p className="text-sm text-semantic-text-muted text-center">
          At least 1 photo is required to continue
        </p>
      )}
    </div>
  );
}
