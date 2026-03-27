'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CaretDown, X, List, ShoppingCart, Bell } from '@phosphor-icons/react/ssr';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-aurora-red text-white ${className ?? ''}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SiteHeader() {
  const { user, profile, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const unreadCount = useUnreadCount();
  const notificationCount = useUnreadNotificationCount();
  const { count: cartCount } = useCart();

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

  const navLinks = (
    <>
      <Link
        href="/browse"
        className="text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors font-medium"
      >
        Browse
      </Link>
      <Link
        href="/sell"
        className="text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors font-medium"
      >
        Sell a game
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 bg-semantic-bg-elevated border-b border-semantic-border-subtle shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-semantic-text-heading font-bold text-lg whitespace-nowrap"
          >
            Second Turn Games
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6">
            {navLinks}

            {/* Cart */}
            <Link
              href="/cart"
              className="relative text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors"
              aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
            >
              <ShoppingCart size={22} />
              <CountBadge count={cartCount} className="absolute -top-1.5 -right-2" />
            </Link>

            {/* Notifications (desktop dropdown) */}
            {user && (
              <NotificationDropdown unreadCount={notificationCount} />
            )}

            {/* Auth */}
            {loading ? (
              <div className="w-20 h-8 rounded-md bg-snow-storm-light animate-pulse" />
            ) : !user ? (
              <Link
                href="/auth/signin"
                className="text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors font-medium"
              >
                Sign in
              </Link>
            ) : (
              <div className="relative">
                <button
                  ref={dropdownButtonRef}
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-1.5 text-semantic-text-secondary sm:hover:text-semantic-text-primary transition-colors font-medium min-h-[44px] px-2"
                >
                  <span className="max-w-[140px] truncate">{displayName}</span>
                  <CaretDown
                    size={16}
                    className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {dropdownOpen && (
                  <div
                    ref={dropdownRef}
                    role="menu"
                    className="absolute right-0 mt-1 w-48 rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg py-1"
                  >
                    <Link
                      href="/account"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-snow-storm-light sm:hover:text-semantic-text-primary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Account
                    </Link>
                    <Link
                      href="/account/listings"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-snow-storm-light sm:hover:text-semantic-text-primary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      My Listings
                    </Link>
                    <Link
                      href="/account/favorites"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-snow-storm-light sm:hover:text-semantic-text-primary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Favorites
                    </Link>
                    <Link
                      href="/messages"
                      role="menuitem"
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-snow-storm-light sm:hover:text-semantic-text-primary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Messages
                      <CountBadge count={unreadCount} className="ml-2" />
                    </Link>
                    <Link
                      href="/account/settings"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-snow-storm-light sm:hover:text-semantic-text-primary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      role="menuitem"
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2.5 text-sm text-semantic-text-secondary sm:hover:bg-snow-storm-light sm:hover:text-semantic-text-primary"
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
            ) : (
              <List size={24} />
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
            <Link
              href="/sell"
              className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Sell a game
            </Link>
            <div className="border-t border-semantic-border-subtle my-1" />
            {loading ? (
              <div className="w-24 h-8 rounded-md bg-snow-storm-light animate-pulse my-2" />
            ) : !user ? (
              <Link
                href="/auth/signin"
                className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            ) : (
              <>
                <Link
                  href="/account"
                  className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Account
                </Link>
                <Link
                  href="/account/listings"
                  className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  My Listings
                </Link>
                <Link
                  href="/account/favorites"
                  className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Favorites
                </Link>
                <Link
                  href="/messages"
                  className="flex items-center py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Messages
                  <CountBadge count={unreadCount} className="ml-2" />
                </Link>
                <Link
                  href="/account/settings"
                  className="py-2.5 text-semantic-text-secondary active:text-semantic-text-primary font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Settings
                </Link>
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

export { SiteHeader };
