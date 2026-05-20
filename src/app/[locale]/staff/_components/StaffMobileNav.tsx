'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, X } from '@phosphor-icons/react/ssr';
import { stripLocalePrefix } from '@/lib/locale-utils';
import { cn } from '@/lib/cn';
import { CountBadge } from '@/components/ui';
import { STAFF_NAV_GROUPS, findActiveKey } from './staff-nav-data';

function StaffMobileNav() {
  const pathname = usePathname();
  const activeKey = findActiveKey(stripLocalePrefix(pathname));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Native close event fires on ESC; mirror to React state + focus return.
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [handleClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="staff-nav-drawer"
        aria-label="Open staff navigation"
        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-semantic-border-default text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
      >
        <List size={18} />
        Menu
      </button>

      <dialog
        ref={dialogRef}
        id="staff-nav-drawer"
        aria-label="Staff navigation"
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose();
        }}
        className="fixed left-0 top-0 bottom-0 h-dvh max-h-dvh w-72 max-w-[85vw] m-0 p-0 border-0 bg-semantic-bg-elevated shadow-xl backdrop:bg-semantic-bg-overlay backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-semantic-border-subtle shrink-0">
            <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-muted">
              Staff dashboard
            </p>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close staff navigation"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-muted active:text-semantic-brand sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
            >
              <X size={20} />
            </button>
          </div>

          <nav
            aria-label="Staff navigation (mobile)"
            className="flex-1 overflow-y-auto px-4 py-4 text-sm"
          >
            {STAFF_NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="text-xs font-semibold text-semantic-text-muted uppercase tracking-wider mb-1.5">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.key === activeKey;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={handleClose}
                          className={cn(
                            'flex items-center justify-between gap-2 px-2 py-2 rounded transition-colors duration-250 ease-out-custom',
                            active
                              ? 'text-semantic-brand font-medium bg-semantic-brand/10'
                              : 'text-semantic-text-secondary active:bg-semantic-bg-subtle sm:hover:text-semantic-text-primary sm:hover:bg-semantic-bg-subtle',
                          )}
                        >
                          <span>{item.label}</span>
                          {item.count !== undefined && item.count > 0 && (
                            <CountBadge count={item.count} />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </dialog>
    </>
  );
}

export { StaffMobileNav };
