import type { ReactNode } from 'react';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';

type SellStepHeaderProps =
  | {
      variant: 'anchor';
      title: string;
      helper: string;
      anchorImage: string | null;
      anchorGameName: string;
    }
  | {
      variant: 'icon';
      title: string;
      helper: string;
      icon: ReactNode;
    };

export function SellStepHeader(props: SellStepHeaderProps) {
  if (props.variant === 'anchor') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm text-semantic-text-muted">
          {props.anchorImage ? (
            <Image
              src={props.anchorImage}
              alt={props.anchorGameName}
              width={56}
              height={56}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-contain bg-semantic-bg-secondary shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-semantic-bg-secondary shrink-0 flex items-center justify-center">
              <ImageSquare size={24} className="text-semantic-text-muted" />
            </div>
          )}
          <span className="truncate">{props.anchorGameName}</span>
        </div>
        <div>
          <h2 className={SECTION_HEADING_CLASS}>
            {props.title}
          </h2>
          <p className="text-sm text-semantic-text-secondary mt-1">{props.helper}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 rounded-md bg-semantic-brand-bg shrink-0 flex items-center justify-center text-semantic-brand">
        {props.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className={SECTION_HEADING_CLASS}>
          {props.title}
        </h2>
        <p className="text-sm text-semantic-text-secondary mt-1">{props.helper}</p>
      </div>
    </div>
  );
}
