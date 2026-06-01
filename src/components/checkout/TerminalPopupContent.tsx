import { Button } from '@/components/ui';
import type { TerminalOption } from '@/lib/services/unisend/types';

export type TerminalPopupAction = 'select' | 'directions';

interface TerminalPopupContentProps {
  terminal: TerminalOption;
  /** 'select' (default) shows the checkout "Select terminal" button.
   *  'directions' shows a read-only "Get directions" link (locker finder). */
  action?: TerminalPopupAction;
  onSelect: () => void;
}

export function TerminalPopupContent({ terminal, action = 'select', onSelect }: TerminalPopupContentProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-semantic-text-heading text-sm">{terminal.name}</h4>
      <p className="text-xs text-semantic-text-secondary">
        {terminal.address}, {terminal.postalCode}
      </p>
      <p className="text-xs text-semantic-text-secondary">{terminal.city}</p>
      {action === 'directions' ? (
        // Raw <a> rather than InlineArrowLink: this renders inside a Mapbox popup as a
        // full-width centered button-link, not inline prose, so the inline-arrow styling
        // would be a poor fit. rel="noopener noreferrer" is set explicitly below.
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${terminal.latitude},${terminal.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-2 text-center text-sm font-medium text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
        >
          Get directions
        </a>
      ) : (
        <Button type="button" size="sm" onClick={onSelect} className="w-full mt-2">
          Select terminal
        </Button>
      )}
    </div>
  );
}
