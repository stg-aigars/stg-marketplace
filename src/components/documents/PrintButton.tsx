'use client';

import { Printer } from '@phosphor-icons/react/ssr';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="shrink-0 p-2 rounded-md text-semantic-text-muted sm:hover:text-semantic-text-primary sm:hover:bg-semantic-bg-secondary transition-colors duration-250 ease-out-custom print:hidden"
      aria-label="Print document"
    >
      <Printer size={20} />
    </button>
  );
}
