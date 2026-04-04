'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ImageSquare, X, CaretLeft, CaretRight } from '@phosphor-icons/react/ssr';
import { isBggImage } from '@/lib/bgg/utils';
import { useTouchGestures } from './useTouchGestures';

interface PhotoGalleryProps {
  photos: string[];
  gameImage: string | null;
  gameTitle: string;
}

/* Lightbox extracted as a separate component so useTouchGestures mounts/unmounts
   with the overlay — avoids the stale-ref problem where the hook's useEffect runs
   before the container DOM node exists. */
function Lightbox({
  images,
  activeIndex,
  gameImage,
  gameTitle,
  onClose,
  onNext,
  onPrev,
}: {
  images: string[];
  activeIndex: number;
  gameImage: string | null;
  gameTitle: string;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const hasMultipleImages = images.length > 1;
  const { containerRef, gestureStyle, isZoomed } = useTouchGestures({
    onSwipeLeft: hasMultipleImages ? onNext : null,
    onSwipeRight: hasMultipleImages ? onPrev : null,
    imageIndex: activeIndex,
  });

  // Keyboard navigation + body scroll lock
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onNext, onPrev]);

  const activeUrl = images[activeIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={isZoomed ? undefined : onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white transition-colors duration-250 ease-out-custom p-2"
        aria-label="Close"
      >
        <X size={28} weight="bold" />
      </button>

      {/* Navigation arrows — hidden when zoomed to prevent accidental taps */}
      {hasMultipleImages && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className={`absolute left-4 z-10 text-white/70 hover:text-white transition-all duration-250 ease-out-custom p-2 ${isZoomed ? 'opacity-0 pointer-events-none' : ''}`}
            aria-label="Previous photo"
          >
            <CaretLeft size={32} weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className={`absolute right-4 z-10 text-white/70 hover:text-white transition-all duration-250 ease-out-custom p-2 ${isZoomed ? 'opacity-0 pointer-events-none' : ''}`}
            aria-label="Next photo"
          >
            <CaretRight size={32} weight="bold" />
          </button>
        </>
      )}

      {/* Full-size image — gesture container for pinch-to-zoom and swipe */}
      <div
        ref={containerRef}
        style={gestureStyle}
        className="relative w-full h-full max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={activeUrl}
          alt={`${gameTitle} - photo ${activeIndex + 1}`}
          fill
          className="object-contain"
          sizes="90vw"
          unoptimized={isBggImage(activeUrl)}
        />
        {activeUrl === gameImage && (
          <span className="absolute bottom-4 right-4 w-8 h-8 rounded bg-black/90 flex items-center justify-center">
            <Image src="/images/bgg-logo.jpeg" alt="BoardGameGeek" width={20} height={20} className="object-contain rounded-sm" />
          </span>
        )}
      </div>

      {/* Image counter */}
      {hasMultipleImages && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
          {activeIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

function PhotoGallery({ photos, gameImage, gameTitle }: PhotoGalleryProps) {
  const images =
    photos.length > 0
      ? gameImage ? [...photos, gameImage] : photos
      : gameImage ? [gameImage] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const openLightbox = useCallback(() => setLightboxOpen(true), []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="aspect-square max-h-[400px] bg-semantic-bg-secondary rounded-lg flex items-center justify-center">
        <ImageSquare size={64} className="text-semantic-text-muted" />
      </div>
    );
  }

  const activeUrl = images[activeIndex];

  return (
    <>
      <div className="space-y-3">
        {/* Main image — click to open lightbox */}
        <button
          type="button"
          onClick={openLightbox}
          className="w-full aspect-square max-h-[400px] bg-semantic-bg-secondary rounded-lg overflow-hidden relative cursor-zoom-in"
        >
          <Image
            src={activeUrl}
            alt={`${gameTitle} - photo ${activeIndex + 1}`}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority={activeIndex === 0}
            unoptimized={isBggImage(activeUrl)}
          />
          {activeUrl === gameImage && (
            <span className="absolute bottom-2 right-2 w-6 h-6 rounded bg-semantic-bg-secondary flex items-center justify-center">
              <Image src="/images/bgg-logo.jpeg" alt="BoardGameGeek" width={16} height={16} className="object-contain rounded-sm" />
            </span>
          )}
        </button>

        {/* Thumbnail strip — only show when there are multiple images */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden transition-colors duration-250 ease-out-custom relative ${
                  i === activeIndex
                    ? 'border-2 border-semantic-brand'
                    : 'border border-semantic-border-subtle sm:hover:border-semantic-border-default'
                }`}
              >
                <Image
                  src={src}
                  alt={`${gameTitle} - thumbnail ${i + 1}`}
                  fill
                  className="object-contain"
                  sizes="64px"
                  unoptimized={isBggImage(src)}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox — separate component so gesture hook mounts with the overlay */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          activeIndex={activeIndex}
          gameImage={gameImage}
          gameTitle={gameTitle}
          onClose={closeLightbox}
          onNext={goNext}
          onPrev={goPrev}
        />
      )}
    </>
  );
}

export { PhotoGallery };
