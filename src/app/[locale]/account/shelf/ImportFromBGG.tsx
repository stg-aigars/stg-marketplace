'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { Modal, Button, Input, Spinner } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { addBulkToShelf } from '@/lib/shelves/actions';

type Step = 'username' | 'loading' | 'preview' | 'importing' | 'done';

interface CollectionItem {
  bggGameId: number;
  name: string;
  yearPublished: number | null;
  thumbnail: string | null;
  inLocalDb: boolean;
  alreadyOnShelf: boolean;
}

interface ImportFromBGGProps {
  isOpen: boolean;
  onClose: () => void;
  savedUsername: string | null;
  onImported: () => void;
}

const MAX_RETRIES = 5;
const POLL_INTERVAL = 3000;

export function ImportFromBGG({
  isOpen,
  onClose,
  savedUsername,
  onImported,
}: ImportFromBGGProps) {
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState(savedUsername ?? '');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const retryCountRef = useRef(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('username');
      setUsername(savedUsername ?? '');
      setItems([]);
      setSelected(new Set());
      setError('');
      setAddedCount(0);
      retryCountRef.current = 0;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    }
  }, [isOpen, savedUsername]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const fetchCollection = useCallback(
    async (isPoll: boolean) => {
      const url = `/api/bgg/collection?username=${encodeURIComponent(username.trim())}${isPoll ? '&poll=1' : ''}`;
      try {
        const res = await apiFetch(url);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to fetch collection');
          setStep('username');
          return;
        }

        if (data.status === 'generating') {
          if (retryCountRef.current >= MAX_RETRIES) {
            setError('BGG is taking too long. Please try again later.');
            setStep('username');
            return;
          }
          retryCountRef.current += 1;
          pollTimeoutRef.current = setTimeout(() => fetchCollection(true), POLL_INTERVAL);
          return;
        }

        if (data.status === 'success') {
          const collectionItems: CollectionItem[] = data.items ?? [];
          setItems(collectionItems);

          // Pre-select eligible items
          const eligible = new Set<number>();
          for (const item of collectionItems) {
            if (item.inLocalDb && !item.alreadyOnShelf) {
              eligible.add(item.bggGameId);
            }
          }
          setSelected(eligible);
          setStep('preview');
        }
      } catch {
        setError('Network error. Please try again.');
        setStep('username');
      }
    },
    [username]
  );

  function handleFetch() {
    if (!username.trim()) return;
    setError('');
    retryCountRef.current = 0;
    setStep('loading');
    fetchCollection(false);
  }

  function toggleItem(bggGameId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bggGameId)) {
        next.delete(bggGameId);
      } else {
        next.add(bggGameId);
      }
      return next;
    });
  }

  const eligibleItems = items.filter((i) => i.inLocalDb && !i.alreadyOnShelf);

  function toggleAll() {
    if (selected.size === eligibleItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleItems.map((i) => i.bggGameId)));
    }
  }

  async function handleImport() {
    const toImport = items
      .filter((i) => selected.has(i.bggGameId))
      .map((i) => ({
        bggGameId: i.bggGameId,
        gameName: i.name,
        gameYear: i.yearPublished,
      }));

    if (!toImport.length) return;

    setStep('importing');
    setError('');

    const result = await addBulkToShelf(toImport, username.trim());

    if ('error' in result) {
      setError(result.error);
      setStep('preview');
      return;
    }

    setAddedCount(result.added);
    setStep('done');

    setTimeout(() => {
      onImported();
      onClose();
    }, 1500);
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Import from BGG">
      <div className="space-y-4 pb-4">
        {/* Step 1: Enter username */}
        {step === 'username' && (
          <>
            <Input
              label="BGG username"
              placeholder="Enter your BoardGameGeek username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetch();
              }}
              autoFocus
            />
            {error && (
              <p className="text-sm text-semantic-error">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleFetch}
                disabled={!username.trim()}
              >
                Fetch collection
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Loading / polling */}
        {step === 'loading' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Spinner size="md" />
            <p className="text-sm text-semantic-text-secondary">
              BGG is preparing your collection...
            </p>
          </div>
        )}

        {/* Step 3: Preview collection */}
        {step === 'preview' && (
          <>
            {items.length === 0 ? (
              <p className="text-sm text-semantic-text-muted text-center py-4">
                No base games found in this collection
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-semantic-text-secondary">
                    {selected.size} of {eligibleItems.length} games selected
                  </p>
                  {eligibleItems.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-sm text-semantic-primary hover:underline"
                    >
                      {selected.size === eligibleItems.length
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  )}
                </div>

                <ul className="max-h-72 overflow-y-auto divide-y divide-semantic-border-subtle rounded-lg border border-semantic-border-subtle">
                  {items.map((item) => {
                    const isEligible = item.inLocalDb && !item.alreadyOnShelf;
                    const isChecked = selected.has(item.bggGameId);

                    return (
                      <li key={item.bggGameId}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                            isEligible
                              ? 'cursor-pointer hover:bg-semantic-bg-surface'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isEligible}
                            onChange={() => isEligible && toggleItem(item.bggGameId)}
                            className="rounded border-semantic-border-default text-semantic-primary focus:ring-semantic-border-focus h-4 w-4 shrink-0"
                          />
                          <div className="w-12 h-12 rounded bg-snow-storm-light flex items-center justify-center overflow-hidden shrink-0">
                            {item.thumbnail ? (
                              <Image
                                src={item.thumbnail}
                                alt={item.name}
                                width={48}
                                height={48}
                                className="object-cover w-full h-full"
                                unoptimized={item.thumbnail.includes('cf.geekdo-images.com')}
                              />
                            ) : (
                              <ImageSquare
                                size={20}
                                className="text-semantic-text-muted"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-semantic-text-primary truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-semantic-text-muted">
                              {item.yearPublished ?? '—'}
                              {item.alreadyOnShelf && ' · Already on shelf'}
                              {!item.inLocalDb && ' · Not in our database yet'}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {error && (
              <p className="text-sm text-semantic-error">{error}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={selected.size === 0}
              >
                Import {selected.size} game{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Spinner size="md" />
            <p className="text-sm text-semantic-text-secondary">
              Importing games...
            </p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <p className="text-semantic-text-heading font-medium">
              Added {addedCount} game{addedCount !== 1 ? 's' : ''} to your shelf
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
