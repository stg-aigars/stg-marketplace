'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X } from '@phosphor-icons/react/ssr';
import { Button, Modal } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeErrorMessage } from '@/lib/utils/error-messages';

interface DisputeFormProps {
  orderId: string;
  onClose: () => void;
  open: boolean;
}

export function DisputeForm({ orderId, onClose, open }: DisputeFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = reason.trim().length >= 10 && !submitting && !uploading;

  async function handleUploadPhoto(file: File) {
    if (photos.length >= 4) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/disputes/photos', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeErrorMessage(data.error));
        return;
      }

      setPhotos((prev) => [...prev, data.url]);
    } catch {
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadPhoto(file);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), photos }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeErrorMessage(data.error));
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report an issue">
      <div className="space-y-4">
        {/* Reason textarea */}
        <div>
          <label
            htmlFor="dispute-reason"
            className="block text-sm font-medium text-semantic-text-primary mb-1"
          >
            Describe the issue
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please describe what is wrong with the item you received..."
            rows={4}
            className="w-full rounded-lg border border-semantic-border-subtle bg-semantic-bg-subtle px-3 py-2 text-sm text-semantic-text-primary placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-primary/40 focus:border-semantic-primary resize-none"
          />
          {reason.length > 0 && reason.trim().length < 10 && (
            <p className="text-xs text-semantic-text-muted mt-1">
              At least 10 characters required
            </p>
          )}
        </div>

        {/* Photo upload */}
        <div>
          <p className="text-sm font-medium text-semantic-text-primary mb-2">
            Add photos (optional, max 4)
          </p>

          {/* Thumbnail grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {photos.map((url, index) => (
                <div key={url} className="relative aspect-square">
                  <Image
                    src={url}
                    alt={`Dispute photo ${index + 1}`}
                    fill
                    sizes="25vw"
                    className="object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-semantic-error text-semantic-text-inverse flex items-center justify-center text-xs leading-none"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length < 4 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-lg border-2 border-dashed border-semantic-border-subtle py-4 text-sm text-semantic-text-muted sm:hover:border-semantic-primary sm:hover:text-semantic-primary transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Click to add a photo'}
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            loading={submitting}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1"
          >
            Submit report
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
