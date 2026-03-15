'use client';

import { useState } from 'react';

interface PhotoGalleryProps {
  photos: string[];
  gameImage: string | null;
  gameTitle: string;
}

function PhotoGallery({ photos, gameImage, gameTitle }: PhotoGalleryProps) {
  const images = photos.length > 0 ? photos : gameImage ? [gameImage] : [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-snow-storm-light rounded-lg flex items-center justify-center">
        <svg
          className="w-16 h-16 text-semantic-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-snow-storm-light rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src={images[activeIndex]}
          alt={`${gameTitle} - photo ${activeIndex + 1}`}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Thumbnail strip — only show when there are multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                i === activeIndex
                  ? 'border-semantic-primary'
                  : 'border-semantic-border-subtle sm:hover:border-semantic-border-default'
              }`}
            >
              <img
                src={src}
                alt={`${gameTitle} - thumbnail ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { PhotoGallery };
