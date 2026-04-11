'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CaretDown, X, ShoppingCart, Bell, UserCircle } from '@phosphor-icons/react/ssr';
import { Avatar, Button, CountBadge } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { stripLocalePrefix } from '@/lib/locale-utils';
import { useCart } from '@/contexts/CartContext';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { usePendingActions } from '@/hooks/usePendingActions';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

function SiteHeader() {
  const { user, profile, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [notificationCount, refreshNotificationCount] = useUnreadNotificationCount();
  const { count: cartCount } = useCart();
  const { isSeller } = usePendingActions();

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        dropdownButtonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dropdownOpen]);

  const handleSignOut = useCallback(async () => {
    setDropdownOpen(false);
    setMobileOpen(false);
    await signOut();
  }, [signOut]);

  const displayName = profile?.full_name || 'Account';

  const isActive = (href: string) => {
    const clean = stripLocalePrefix(pathname);
    return clean === href || (href !== '/' && clean.startsWith(href + '/'));
  };

  const navLinkClass = (href: string) =>
    isActive(href)
      ? 'bg-semantic-brand-bg text-semantic-brand font-semibold rounded-md px-3 py-1.5 transition-all duration-250 ease-out-custom'
      : 'text-semantic-text-secondary sm:hover:text-semantic-text-primary rounded-md px-3 py-1.5 transition-all duration-250 ease-out-custom font-medium';

  const navLinks = (
    <>
      <Link href="/browse" className={navLinkClass('/browse')}>
        Browse
      </Link>
      <Button variant="brand" size="sm" asChild className="min-h-0 py-1.5 text-base">
        <Link href="/sell">Sell a game</Link>
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-50 bg-semantic-bg-elevated/85 backdrop-blur-xl border-b border-semantic-border-subtle shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, next/image adds no value for vectors */}
            <img src="/favicon.svg" alt="" width={32} height={32} className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="flex flex-col leading-none gap-0 translate-y-0.5">
              <span className="text-[10px] sm:text-[11px] font-bold tracking-wide">
                <span className="text-semantic-brand">Every game deserves a</span>
              </span>
              <span className="text-lg sm:text-xl font-display font-bold text-semantic-primary tracking-wide">
                Second Turn
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6">
            {navLinks}

            {/* Cart */}
            <Link
              href="/cart"
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
              aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
            >
              <ShoppingCart size={22} />
              <CountBadge count={cartCount} className="absolute -top-0.5 -right-0.5" />
            </Link>

            {/* Notifications (desktop dropdown) */}
            {user && (
              <NotificationDropdown unreadCount={notificationCount} onCountChange={refreshNotificationCount} />
            )}

            {/* Auth */}
            {loading ? (
              <div className="w-20 h-8 rounded-md bg-semantic-bg-secondary animate-pulse" />
            ) : !user ? (
              <Button variant="secondary" size="sm" asChild className="min-h-0 py-1.5 text-base">
                <Link href="/auth/signin">Sign in</Link>
              </Button>
            ) : (
              <div className="relative">
                <button
                  ref={dropdownButtonRef}
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  aria-label={displayName}
                  className="flex items-center gap-1.5 text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom font-medium min-h-[44px] px-2"
                >
                  <Avatar name={displayName} src={profile?.avatar_url} size="nav" />
                  <CaretDown
                    size={16}
                    className={`transition-transform duration-150 ease-out-custom ${dropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    ref={dropdownRef}
                    role="menu"
                    className="absolute right-0 mt-1 w-48 rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg py-1"
                  >
                    {isSeller && (
                      <>
                        <DropdownLink href="/account/orders?tab=sales" label="Sales" onClose={() => setDropdownOpen(false)} />
                        <DropdownLink href="/account/wallet" label="Wallet" onClose={() => setDropdownOpen(false)} />
                      </>
                    )}
                    <DropdownLink href="/account/orders?tab=purchases" label="Purchases" onClose={() => setDropdownOpen(false)} />
                    <DropdownLink href="/account" label="Account" onClose={() => setDropdownOpen(false)} />
                    {profile?.is_staff && (
                      <DropdownLink href="/staff" label="Staff" onClose={() => setDropdownOpen(false)} />
                    )}
                    <div className="border-t border-semantic-border-subtle my-1" />
                    <button
                      role="menuitem"
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-semantic-bg-secondary sm:hover:text-semantic-text-primary"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Mobile: notifications + cart + hamburger */}
          <div className="sm:hidden flex items-center gap-1">
            {user && (
              <Link
                href="/account/notifications"
                className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-secondary"
                aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
              >
                <Bell size={22} weight={notificationCount > 0 ? 'fill' : 'regular'} />
                <CountBadge count={notificationCount} className="absolute top-1 right-0.5" />
              </Link>
            )}
            <Link
              href="/cart"
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-secondary"
              aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
            >
              <ShoppingCart size={22} />
              <CountBadge count={cartCount} className="absolute top-1 right-0.5" />
            </Link>
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-secondary"
          >
            {mobileOpen ? (
              <X size={24} />
            ) : user ? (
              <Avatar name={displayName} src={profile?.avatar_url} size="nav" />
            ) : (
              <UserCircle size={24} />
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="sm:hidden border-t border-semantic-border-subtle bg-semantic-bg-elevated px-4 pb-4 pt-2">
          <div className="flex flex-col gap-1">
            <Link
              href="/browse"
              className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Browse
            </Link>
            <Button variant="brand" size="sm" asChild className="w-full mt-1">
              <Link href="/sell" onClick={() => setMobileOpen(false)}>Sell a game</Link>
            </Button>
            <div className="border-t border-semantic-border-subtle my-1" />
            {loading ? (
              <div className="w-24 h-8 rounded-md bg-semantic-bg-secondary animate-pulse my-2" />
            ) : !user ? (
              <Button variant="secondary" size="sm" asChild className="w-full">
                <Link href="/auth/signin" onClick={() => setMobileOpen(false)}>Sign in</Link>
              </Button>
            ) : (
              <>
                {isSeller && (
                  <>
                    <MobileLink href="/account/orders?tab=sales" label="Sales" onClose={() => setMobileOpen(false)} />
                    <MobileLink href="/account/wallet" label="Wallet" onClose={() => setMobileOpen(false)} />
                  </>
                )}
                <MobileLink href="/account/orders?tab=purchases" label="Purchases" onClose={() => setMobileOpen(false)} />
                <MobileLink href="/account" label="Account" onClose={() => setMobileOpen(false)} />
                {profile?.is_staff && (
                  <MobileLink href="/staff" label="Staff" onClose={() => setMobileOpen(false)} />
                )}
                <button
                  onClick={handleSignOut}
                  className="py-2.5 text-left text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function DropdownLink({ href, label, onClose }: { href: string; label: string; onClose: () => void }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="block px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-semantic-bg-secondary sm:hover:text-semantic-text-primary"
      onClick={onClose}
    >
      {label}
    </Link>
  );
}

function MobileLink({ href, label, onClose }: { href: string; label: string; onClose: () => void }) {
  return (
    <Link
      href={href}
      className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
      onClick={onClose}
    >
      {label}
    </Link>
  );
}

export { SiteHeader };
