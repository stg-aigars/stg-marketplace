'use client';

import {
  Info,
  Warning,
  CheckCircle,
  XCircle,
  Package,
  MagnifyingGlass,
  CurrencyEur,
} from '@phosphor-icons/react/ssr';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Badge,
  Alert,
  Avatar,
  Spinner,
  Skeleton,
  Breadcrumb,
  Pagination,
  NavTabs,
  Stepper,
  EmptyState,
  Select,
  Input,
  Modal,
} from '@/components/ui';
import { GameThumb, GameTitle, GameMeta, Price } from '@/components/listings/atoms';
import { ListingCard } from '@/components/listings/ListingCard';
import { ListingCardMini } from '@/components/listings/ListingCardMini';
import { ListingRow } from '@/components/listings/ListingRow';
import { ListingCardSkeleton } from '@/components/listings/ListingCardSkeleton';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { ReservationCountdown } from '@/components/listings/ReservationCountdown';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// Lazy-load ShareButtons to avoid hydration mismatch from navigator.share check
const ShareButtons = dynamic(() => import('@/components/ui/share-buttons').then((m) => m.ShareButtons), { ssr: false });

import { ShowcaseSection } from './ShowcaseSection';
import { ShowcaseSidebar } from './ShowcaseSidebar';
import {
  MOCK_LISTING,
  MOCK_LISTING_AUCTION,
  MOCK_LISTING_UNAVAILABLE,
  MOCK_LISTING_MINI,
  MOCK_LISTING_ROW,
  SAMPLE_BREADCRUMBS_2,
  SAMPLE_BREADCRUMBS_3,
  SAMPLE_BREADCRUMBS_4,
  SAMPLE_NAV_TABS_UNDERLINE,
  SAMPLE_NAV_TABS_PILL,
  SAMPLE_STEPPER_STEPS,
  SAMPLE_GAME_NAMES,
  SAMPLE_PRICES,
  SAMPLE_TAB_ITEMS,
} from './mock-data';

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-semantic-text-secondary mb-2">{children}</h3>;
}

function Swatch({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div>
      {label && <p className="text-xs text-semantic-text-muted mb-1">{label}</p>}
      {children}
    </div>
  );
}

// -- Inline demos (no need for separate files when everything is 'use client') --

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Example Modal">
        <div className="space-y-3 pb-6">
          <p className="text-sm text-semantic-text-secondary">
            This is an example modal. On mobile it appears as a bottom sheet with a drag handle.
            On desktop it&apos;s a centered dialog with backdrop blur.
          </p>
          <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}

function AlertDismissibleDemo() {
  const [dismissed, setDismissed] = useState(false);
  return dismissed ? (
    <div className="flex items-center gap-3">
      <p className="text-sm text-semantic-text-muted">Dismissed.</p>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(false)}>Reset</Button>
    </div>
  ) : (
    <Alert variant="warning" icon={Warning} title="Dismissible alert" dismissible onDismiss={() => setDismissed(true)}>
      This alert can be dismissed. Click the X to try it.
    </Alert>
  );
}

function TabsDemo() {
  const [activeTab, setActiveTab] = useState('all');
  return (
    <div>
      <div className="flex gap-1 border-b border-semantic-border-subtle" role="tablist">
        {SAMPLE_TAB_ITEMS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors duration-250 ease-out-custom relative ${
                isActive ? 'text-semantic-brand' : 'text-semantic-text-muted sm:hover:text-semantic-text-secondary'
              }`}
            >
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-semantic-brand" />}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-semantic-text-muted mt-3">
        Active: <span className="font-medium text-semantic-text-primary">{activeTab}</span>
      </p>
    </div>
  );
}

// Mock reservedAt 10min ago (~20min remaining on 30min TTL)
const RESERVATION_TIME = new Date(Date.now() - 10 * 60 * 1000).toISOString();

export function ShowcaseContent() {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-8">
        Component Showcase
      </h1>

      <div className="flex gap-8">
        <ShowcaseSidebar />

        <div className="flex-1 min-w-0">
          {/* ===== FOUNDATIONS ===== */}

          <ShowcaseSection id="spinner" title="Spinner" description="Animated loading indicator in three sizes.">
            <div className="flex items-center gap-6">
              <Swatch label="sm"><Spinner size="sm" /></Swatch>
              <Swatch label="md"><Spinner size="md" /></Swatch>
              <Swatch label="lg"><Spinner size="lg" /></Swatch>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="skeleton" title="Skeleton" description="Pulsing placeholder for loading states.">
            <div className="space-y-3 max-w-sm">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="avatar" title="Avatar" description="User initials in two sizes.">
            <div className="flex items-center gap-4">
              <Swatch label="sm"><Avatar name="John" size="sm" /></Swatch>
              <Swatch label="md"><Avatar name="Anna" size="md" /></Swatch>
              <Swatch label="sm"><Avatar name="Zoe" size="sm" /></Swatch>
              <Swatch label="md"><Avatar name="Max" size="md" /></Swatch>
            </div>
          </ShowcaseSection>

          {/* ===== UI COMPONENTS ===== */}

          <ShowcaseSection id="button" title="Button" description="4 variants, 3 sizes, loading and disabled states.">
            <div>
              <SubHeading>Variants x Sizes</SubHeading>
              <div className="space-y-3">
                {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
                  <div key={variant} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-semantic-text-muted w-20">{variant}</span>
                    <Button variant={variant} size="sm">Small</Button>
                    <Button variant={variant} size="md">Medium</Button>
                    <Button variant={variant} size="lg">Large</Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SubHeading>Loading</SubHeading>
              <div className="flex flex-wrap gap-2">
                <Button loading>Loading...</Button>
                <Button variant="secondary" loading>Saving</Button>
              </div>
            </div>
            <div>
              <SubHeading>Disabled</SubHeading>
              <div className="flex flex-wrap gap-2">
                <Button disabled>Disabled</Button>
                <Button variant="secondary" disabled>Disabled</Button>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="card" title="Card" description="Container with optional header, body, footer, and hoverable state.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <Card>
                <CardBody>
                  <p className="text-sm text-semantic-text-secondary">Default card with CardBody</p>
                </CardBody>
              </Card>
              <Card hoverable>
                <CardBody>
                  <p className="text-sm text-semantic-text-secondary">Hoverable card (try hovering)</p>
                </CardBody>
              </Card>
              <Card className="sm:col-span-2">
                <CardHeader>
                  <h3 className="text-base font-semibold">Card with sections</h3>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-semantic-text-secondary">This card uses CardHeader, CardBody, and CardFooter.</p>
                </CardBody>
                <CardFooter>
                  <Button size="sm" variant="secondary">Action</Button>
                </CardFooter>
              </Card>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="badge" title="Badge" description="Status variants, condition badges with icons, and dot indicator.">
            <div>
              <SubHeading>Variants</SubHeading>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="trust">Trust</Badge>
              </div>
            </div>
            <div>
              <SubHeading>Conditions (with icons)</SubHeading>
              <div className="flex flex-wrap gap-2">
                <Badge condition="likeNew">Like New</Badge>
                <Badge condition="veryGood">Very Good</Badge>
                <Badge condition="good">Good</Badge>
                <Badge condition="acceptable">Acceptable</Badge>
                <Badge condition="forParts">For Parts</Badge>
              </div>
            </div>
            <div>
              <SubHeading>With dot</SubHeading>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" dot>Active</Badge>
                <Badge variant="warning" dot>Pending</Badge>
                <Badge variant="error" dot>Declined</Badge>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="input" title="Input" description="Text input with label, error, prefix/suffix, and password toggle.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <Input label="Standard" placeholder="Enter text..." />
              <Input label="With error" placeholder="Invalid value" error="This field is required" />
              <Input label="With prefix" prefix={<MagnifyingGlass size={16} />} placeholder="Search..." />
              <Input label="With suffix" suffix={<CurrencyEur size={16} />} placeholder="0.00" />
              <Input label="Password" type="password" placeholder="Enter password..." />
              <Input label="Disabled" placeholder="Cannot edit" disabled />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="select" title="Select" description="Dropdown select with label, error, and placeholder.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <Select
                label="Country"
                placeholder="Select country..."
                options={[
                  { value: 'LV', label: 'Latvia' },
                  { value: 'LT', label: 'Lithuania' },
                  { value: 'EE', label: 'Estonia' },
                ]}
              />
              <Select
                label="With error"
                error="Please select a country"
                options={[
                  { value: 'LV', label: 'Latvia' },
                  { value: 'LT', label: 'Lithuania' },
                ]}
              />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="modal" title="Modal" description="Dialog on desktop, bottom sheet on mobile. Click to try.">
            <ModalDemo />
          </ShowcaseSection>

          <ShowcaseSection id="alert" title="Alert" description="Contextual messages in 4 variants with optional icon, title, and dismiss.">
            <div className="space-y-3 max-w-xl">
              <Alert variant="info" icon={Info} title="Info">Informational message with icon and title.</Alert>
              <Alert variant="success" icon={CheckCircle}>Success message without title.</Alert>
              <Alert variant="warning" icon={Warning} title="Warning">Something needs attention.</Alert>
              <Alert variant="error" icon={XCircle} title="Error">Something went wrong.</Alert>
            </div>
            <div className="max-w-xl">
              <SubHeading>Dismissible</SubHeading>
              <AlertDismissibleDemo />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="breadcrumb" title="Breadcrumb" description="Navigation trail with clickable ancestors.">
            <div className="space-y-4">
              <Swatch label="2 levels"><Breadcrumb items={SAMPLE_BREADCRUMBS_2} /></Swatch>
              <Swatch label="3 levels"><Breadcrumb items={SAMPLE_BREADCRUMBS_3} /></Swatch>
              <Swatch label="4 levels"><Breadcrumb items={SAMPLE_BREADCRUMBS_4} /></Swatch>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="pagination" title="Pagination" description="Page navigation with item counts and ellipsis.">
            <div className="space-y-6">
              <Swatch label="Page 1 of 5">
                <Pagination currentPage={1} totalPages={5} totalItems={47} pageSize={10} buildUrl={(p) => `#page-${p}`} />
              </Swatch>
              <Swatch label="Page 3 of 10">
                <Pagination currentPage={3} totalPages={10} totalItems={98} pageSize={10} buildUrl={(p) => `#page-${p}`} />
              </Swatch>
              <Swatch label="Page 8 of 10">
                <Pagination currentPage={8} totalPages={10} totalItems={98} pageSize={10} buildUrl={(p) => `#page-${p}`} />
              </Swatch>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="tabs" title="Tabs" description="State-based tabs with optional counts.">
            <TabsDemo />
          </ShowcaseSection>

          <ShowcaseSection id="navtabs" title="NavTabs" description="Link-based navigation tabs in underline and pill variants.">
            <div className="space-y-6">
              <Swatch label="Underline variant">
                <NavTabs tabs={SAMPLE_NAV_TABS_UNDERLINE} activeTab="overview" />
              </Swatch>
              <Swatch label="Pill variant">
                <NavTabs tabs={SAMPLE_NAV_TABS_PILL} activeTab="strategy" variant="pill" />
              </Swatch>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="stepper" title="Stepper" description="Step progress with completion indicators.">
            <div className="space-y-6 max-w-xl">
              <Swatch label="Step 1 (game)">
                <Stepper steps={SAMPLE_STEPPER_STEPS} currentStep="game" />
              </Swatch>
              <Swatch label="Step 3 (photos)">
                <Stepper steps={SAMPLE_STEPPER_STEPS} currentStep="photos" />
              </Swatch>
              <Swatch label="Step 4 (review)">
                <Stepper steps={SAMPLE_STEPPER_STEPS} currentStep="review" />
              </Swatch>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="empty-state" title="EmptyState" description="Placeholder for zero-result or empty views.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card>
                <EmptyState
                  icon={Package}
                  title="No listings yet"
                  description="Start selling your pre-loved board games."
                  action={{ label: 'Create listing', href: '#empty-state' }}
                />
              </Card>
              <Card>
                <EmptyState
                  icon={MagnifyingGlass}
                  title="No results found"
                  description="Try adjusting your search filters."
                  action={{ label: 'Clear filters', href: '#empty-state' }}
                  secondaryAction={{ label: 'Browse all', href: '#empty-state' }}
                />
              </Card>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="share-buttons" title="ShareButtons" description="Copy link and native share (mobile only).">
            <ShareButtons url="https://secondturn.games/listings/demo-listing" title="Catan — Very Good condition" />
          </ShowcaseSection>

          <ShowcaseSection id="toaster" title="Toaster" description="Toast notifications via Sonner. Click buttons to trigger.">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => toast.success('Item saved successfully')}>Success</Button>
              <Button size="sm" variant="danger" onClick={() => toast.error('Something went wrong')}>Error</Button>
              <Button size="sm" variant="secondary" onClick={() => toast.info('Your session will expire in 5 minutes')}>Info</Button>
              <Button size="sm" variant="ghost" onClick={() => toast.warning('Low wallet balance')}>Warning</Button>
            </div>
          </ShowcaseSection>

          {/* ===== LISTING ATOMS ===== */}

          <ShowcaseSection id="game-thumb" title="GameThumb" description="Game thumbnail in 4 sizes with fallback icon.">
            <div>
              <SubHeading>With image (null — shows fallback)</SubHeading>
              <div className="flex items-end gap-4">
                <Swatch label="sm"><GameThumb src={null} alt="Demo" size="sm" /></Swatch>
                <Swatch label="md"><GameThumb src={null} alt="Demo" size="md" /></Swatch>
                <Swatch label="lg"><GameThumb src={null} alt="Demo" size="lg" /></Swatch>
                <Swatch label="xl"><GameThumb src={null} alt="Demo" size="xl" /></Swatch>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="game-title" title="GameTitle" description="Game name display with size, serif, and line clamping.">
            <div className="space-y-4 max-w-md">
              <div>
                <SubHeading>Sizes (serif)</SubHeading>
                <div className="space-y-1">
                  <GameTitle name={SAMPLE_GAME_NAMES[0]} size="xs" />
                  <GameTitle name={SAMPLE_GAME_NAMES[0]} size="sm" />
                  <GameTitle name={SAMPLE_GAME_NAMES[0]} size="md" />
                  <GameTitle name={SAMPLE_GAME_NAMES[0]} size="lg" />
                </div>
              </div>
              <div>
                <SubHeading>Sans-serif</SubHeading>
                <GameTitle name={SAMPLE_GAME_NAMES[1]} size="md" serif={false} />
              </div>
              <div>
                <SubHeading>Clamping (2 lines, long title)</SubHeading>
                <div className="max-w-[200px]">
                  <GameTitle name={SAMPLE_GAME_NAMES[2]} size="md" clamp={2} />
                </div>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="game-meta" title="GameMeta" description="Year and publisher metadata line.">
            <div className="space-y-2">
              <Swatch label="Year + Publisher"><GameMeta year={2019} publisher="Stonemaier Games" /></Swatch>
              <Swatch label="Year only"><GameMeta year={1995} /></Swatch>
              <Swatch label="Publisher only"><GameMeta publisher="Days of Wonder" /></Swatch>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="price" title="Price" description="Formatted currency from cents in 3 sizes.">
            <div className="flex items-end gap-6">
              {SAMPLE_PRICES.map((cents) => (
                <div key={cents}>
                  <div className="flex items-end gap-3">
                    <Swatch label="sm"><Price cents={cents} size="sm" /></Swatch>
                    <Swatch label="md"><Price cents={cents} size="md" /></Swatch>
                    <Swatch label="lg"><Price cents={cents} size="lg" /></Swatch>
                  </div>
                </div>
              ))}
            </div>
          </ShowcaseSection>

          {/* ===== LISTING COMPONENTS ===== */}

          <ShowcaseSection id="listing-card" title="ListingCard" description="Full listing card with image, condition, price, and optional auction/unavailable states.">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <ListingCard {...MOCK_LISTING} />
              <ListingCard {...MOCK_LISTING_AUCTION} />
              <ListingCard {...MOCK_LISTING_UNAVAILABLE} />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="listing-card-mini" title="ListingCardMini" description="Compact card for 2-column mobile grids.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg">
              <ListingCardMini {...MOCK_LISTING_MINI} />
              <ListingCardMini {...{ ...MOCK_LISTING_MINI, id: 'mini-2', gameTitle: 'Azul', condition: 'good' as const, priceCents: 1800 }} />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="listing-row" title="ListingRow" description="Horizontal row layout for list views.">
            <div className="space-y-2 max-w-md">
              <ListingRow listing={MOCK_LISTING_ROW} />
              <ListingRow listing={{ ...MOCK_LISTING_ROW, id: 'row-2', game_name: 'Ticket to Ride', game_year: 2004, price_cents: 3500, condition: 'like_new' }} />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="listing-card-skeleton" title="ListingCardSkeleton" description="Loading placeholder matching ListingCard dimensions.">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="favorite-button" title="FavoriteButton" description="Heart toggle for favorites. Display-only — clicks are intercepted.">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                  <FavoriteButton listingId="demo-unfav" initialFavorited={false} isAuthenticated={false} />
                </div>
                <p className="text-xs text-semantic-text-muted mt-1">Unfavorited</p>
              </div>
              <div className="text-center">
                <div onClick={(e) => { e.stopPropagation(); e.preventDefault(); }} onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                  <FavoriteButton listingId="demo-fav" initialFavorited={true} isAuthenticated={false} />
                </div>
                <p className="text-xs text-semantic-text-muted mt-1">Favorited</p>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection id="reservation-countdown" title="ReservationCountdown" description="Live countdown timer for listing reservations.">
            <div className="space-y-6 max-w-md">
              <div>
                <SubHeading>Card (buyer — owner)</SubHeading>
                <ReservationCountdown reservedAt={RESERVATION_TIME} isOwner />
              </div>
              <div>
                <SubHeading>Card (other buyer)</SubHeading>
                <ReservationCountdown reservedAt={RESERVATION_TIME} />
              </div>
              <div>
                <SubHeading>Compact (inline)</SubHeading>
                <ReservationCountdown reservedAt={RESERVATION_TIME} isOwner compact />
              </div>
            </div>
          </ShowcaseSection>

          {/* ===== SKIPPED NOTES ===== */}

          <div className="mt-8 border-t border-semantic-border-subtle pt-8">
            <h2 className="text-lg font-semibold text-semantic-text-heading mb-3">Not shown</h2>
            <ul className="text-sm text-semantic-text-muted space-y-1">
              <li><strong>TurnstileWidget</strong> — Invisible Cloudflare CAPTCHA; requires a valid site key and cannot be visually demonstrated.</li>
              <li><strong>AddToCartButton</strong> — Requires active cart context and valid listing data; interacts with real cart state.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
