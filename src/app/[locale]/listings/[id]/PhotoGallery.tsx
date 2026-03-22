'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react';

interface PhotoGalleryProps {
  photos: string[];
  gameImage: string | null;
  gameTitle: string;
}

function isBGGImage(url: string): boolean {
  return url.includes('cf.geekdo-images.com');
}

function PhotoGallery({ photos, gameImage, gameTitle }: PhotoGalleryProps) {
  const images = photos.length > 0 ? photos : gameImage ? [gameImage] : [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-snow-storm-light rounded-lg flex items-center justify-center">
        <ImageSquare size={64} className="text-semantic-text-muted" />
      </div>
    );
  }

  const activeUrl = images[activeIndex];

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-snow-storm-light rounded-lg overflow-hidden relative">
        <Image
          src={activeUrl}
          alt={`${gameTitle} - photo ${activeIndex + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority={activeIndex === 0}
          unoptimized={isBGGImage(activeUrl)}
        />
      </div>

      {/* Thumbnail strip — only show when there are multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden transition-colors relative ${
                i === activeIndex
                  ? 'border-2 border-semantic-primary'
                  : 'border border-semantic-border-subtle sm:hover:border-semantic-border-default'
              }`}
            >
              <Image
                src={src}
                alt={`${gameTitle} - thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
                unoptimized={isBGGImage(src)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { PhotoGallery };
