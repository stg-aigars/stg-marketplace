import type { ListingCondition } from '@/lib/listings/types';

// -- Listing mock data --

export const MOCK_LISTING = {
  id: 'showcase-1',
  gameTitle: 'Catan',
  gameYear: 1995 as number | null,
  gameThumbnail: null as string | null,
  firstPhoto: null as string | null,
  condition: 'very_good' as ListingCondition,
  priceCents: 2500,
  sellerCountry: 'LV',
  photoCount: 3,
  isFavorited: false,
  isAuthenticated: false,
};

export const MOCK_LISTING_AUCTION = {
  ...MOCK_LISTING,
  id: 'showcase-2',
  gameTitle: 'Wingspan',
  gameYear: 2019 as number | null,
  condition: 'like_new' as ListingCondition,
  priceCents: 1500,
  sellerCountry: 'LT',
  isAuction: true,
  bidCount: 4,
  auctionEndAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
};

export const MOCK_LISTING_UNAVAILABLE = {
  ...MOCK_LISTING,
  id: 'showcase-3',
  gameTitle: 'Pandemic',
  gameYear: 2008 as number | null,
  condition: 'good' as ListingCondition,
  priceCents: 1800,
  sellerCountry: 'EE',
  unavailable: true,
};

export const MOCK_LISTING_MINI = {
  id: 'showcase-mini-1',
  gameTitle: 'Ticket to Ride: Europe',
  gameThumbnail: null as string | null,
  firstPhoto: null as string | null,
  condition: 'very_good' as ListingCondition,
  priceCents: 3200,
};

export const MOCK_LISTING_ROW = {
  id: 'showcase-row-1',
  game_name: 'Azul',
  game_year: 2017 as number | null,
  price_cents: 2200,
  condition: 'good' as ListingCondition,
  photos: [] as string[],
  bgg_thumbnail: null as string | null,
};

// -- Breadcrumbs --

export const SAMPLE_BREADCRUMBS_2 = [
  { label: 'Home', href: '/' },
  { label: 'Browse' },
];

export const SAMPLE_BREADCRUMBS_3 = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/browse' },
  { label: 'Strategy Games' },
];

export const SAMPLE_BREADCRUMBS_4 = [
  { label: 'Home', href: '/' },
  { label: 'Account', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Order #1234' },
];

// -- Tabs --

export const SAMPLE_TAB_ITEMS = [
  { key: 'all', label: 'All', count: 42 },
  { key: 'active', label: 'Active', count: 18 },
  { key: 'sold', label: 'Sold', count: 24 },
];

export const SAMPLE_NAV_TABS_UNDERLINE = [
  { key: 'overview', label: 'Overview', href: '#navtabs-demo' },
  { key: 'listings', label: 'Listings', href: '#navtabs-demo', count: 12 },
  { key: 'reviews', label: 'Reviews', href: '#navtabs-demo', count: 5 },
];

export const SAMPLE_NAV_TABS_PILL = [
  { key: 'all', label: 'All', href: '#navtabs-demo' },
  { key: 'strategy', label: 'Strategy', href: '#navtabs-demo', count: 8 },
  { key: 'family', label: 'Family', href: '#navtabs-demo', count: 14 },
  { key: 'party', label: 'Party', href: '#navtabs-demo', count: 6 },
];

// -- Stepper --

export const SAMPLE_STEPPER_STEPS = [
  { id: 'game', label: 'Select game' },
  { id: 'details', label: 'Details' },
  { id: 'photos', label: 'Photos' },
  { id: 'review', label: 'Review' },
];

// -- Filter options --

export const SAMPLE_FILTER_OPTIONS = [
  'Strategy',
  'Family',
  'Party',
  'Cooperative',
  'Deck Building',
  'Worker Placement',
];

// -- Game names for atom demos --

export const SAMPLE_GAME_NAMES = [
  'Catan',
  'Gloomhaven: Jaws of the Lion',
  'Terraforming Mars: Ares Expedition — Foundations',
];

// -- Prices for Price demos (in cents) --

export const SAMPLE_PRICES = [499, 2500, 12999];

// -- Sidebar navigation sections --

export interface SidebarSection {
  group: string;
  items: { id: string; label: string }[];
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    group: 'Foundations',
    items: [
      { id: 'spinner', label: 'Spinner' },
      { id: 'skeleton', label: 'Skeleton' },
      { id: 'avatar', label: 'Avatar' },
    ],
  },
  {
    group: 'UI Components',
    items: [
      { id: 'button', label: 'Button' },
      { id: 'card', label: 'Card' },
      { id: 'badge', label: 'Badge' },
      { id: 'input', label: 'Input' },
      { id: 'select', label: 'Select' },
      { id: 'modal', label: 'Modal' },
      { id: 'alert', label: 'Alert' },
      { id: 'breadcrumb', label: 'Breadcrumb' },
      { id: 'pagination', label: 'Pagination' },
      { id: 'tabs', label: 'Tabs' },
      { id: 'navtabs', label: 'NavTabs' },
      { id: 'stepper', label: 'Stepper' },
      { id: 'empty-state', label: 'EmptyState' },
      { id: 'share-buttons', label: 'ShareButtons' },
      { id: 'toaster', label: 'Toaster' },
    ],
  },
  {
    group: 'Listing Atoms',
    items: [
      { id: 'game-thumb', label: 'GameThumb' },
      { id: 'game-title', label: 'GameTitle' },
      { id: 'game-meta', label: 'GameMeta' },
      { id: 'price', label: 'Price' },
    ],
  },
  {
    group: 'Listing Components',
    items: [
      { id: 'listing-card', label: 'ListingCard' },
      { id: 'listing-card-mini', label: 'ListingCardMini' },
      { id: 'listing-row', label: 'ListingRow' },
      { id: 'listing-card-skeleton', label: 'ListingCardSkeleton' },
      { id: 'favorite-button', label: 'FavoriteButton' },
      { id: 'filter-multi-select', label: 'FilterMultiSelect' },
      { id: 'reservation-countdown', label: 'ReservationCountdown' },
    ],
  },
];
