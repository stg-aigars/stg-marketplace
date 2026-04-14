'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type CartItem, MAX_CART_ITEMS, CART_STORAGE_KEY } from '@/lib/checkout/cart-types';
import { useAuth } from '@/contexts/AuthContext';

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (listingId: string) => void;
  removeItems: (listingIds: string[]) => void;
  clearCart: () => void;
  isInCart: (listingId: string) => boolean;
  isFull: boolean;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as CartItem[];
    // Normalize old items missing seller fields
    return items.map((item) => ({
      ...item,
      sellerName: item.sellerName ?? 'Seller',
      sellerAvatarUrl: item.sellerAvatarUrl ?? null,
      isAuction: item.isAuction ?? false,
      auctionDeadlineAt: item.auctionDeadlineAt ?? null,
    }));
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage might be full or unavailable
  }
}

function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Hydrate from localStorage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage
    setItems(loadCart());
    setHydrated(true);
  }, []);

  // Clear cart when user signs out or switches to a different user.
  // Declared before the persistence effect so React processes it first.
  useEffect(() => {
    if (authLoading) return;
    const userId = user?.id ?? null;
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    // First resolution after mount — just record, don't clear
    if (prev === undefined) return;

    // User signed out or switched to a different user
    if (prev && prev !== userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing cart on user change
      setItems([]);
    }
  }, [user, authLoading]);

  // Persist to localStorage on change (after initial hydration)
  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === CART_STORAGE_KEY) {
        try {
          setItems(e.newValue ? (JSON.parse(e.newValue) as CartItem[]).map((item) => ({
            ...item,
            sellerName: item.sellerName ?? 'Seller',
            sellerAvatarUrl: item.sellerAvatarUrl ?? null,
            isAuction: item.isAuction ?? false,
            auctionDeadlineAt: item.auctionDeadlineAt ?? null,
          })) : []);
        } catch {
          setItems([]);
        }
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addItem = useCallback(
    (item: CartItem): void => {
      setItems((prev) => {
        if (prev.length >= MAX_CART_ITEMS) return prev;
        if (prev.some((i) => i.listingId === item.listingId)) return prev;
        return [...prev, item];
      });
    },
    []
  );

  const removeItem = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const removeItems = useCallback((listingIds: string[]) => {
    const idSet = new Set(listingIds);
    setItems((prev) => prev.filter((i) => !idSet.has(i.listingId)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (listingId: string) => items.some((i) => i.listingId === listingId),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      removeItems,
      clearCart,
      isInCart,
      isFull: items.length >= MAX_CART_ITEMS,
      count: items.length,
    }),
    [items, addItem, removeItem, removeItems, clearCart, isInCart]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export { CartProvider, useCart };
