import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Lightning, PiggyBank, Wallet } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';

interface SellerValuePropProps {
  variant?: 'default' | 'compact';
}

interface ValueProp {
  Icon: PhosphorIcon;
  title: string;
  body: string;
}

const VALUE_PROPS: ValueProp[] = [
  {
    Icon: Lightning,
    title: 'List in about a minute',
    body: "Search BoardGameGeek, pick your edition, add a few photos and your price. We pre-fill the metadata so you don't have to.",
  },
  {
    Icon: PiggyBank,
    title: 'Keep 90%',
    body: 'No listing fees. We take a 10% commission only when your game sells, and never on shipping.',
  },
  {
    Icon: Wallet,
    title: 'Get paid to your wallet',
    body: 'Earnings credit on order completion. Withdraw to your bank account whenever you want — no minimum.',
  },
];

function SellerValueProp({ variant = 'default' }: SellerValuePropProps) {
  const isCompact = variant === 'compact';

  const sectionPadding = isCompact ? 'py-4 sm:py-6' : 'py-8 sm:py-10 lg:py-12';
  const headingClass = isCompact
    ? 'text-base font-bold tracking-tight text-semantic-text-heading'
    : 'text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading';
  const gridGap = isCompact ? 'gap-4' : 'gap-6';
  const cardPadding = isCompact ? 'p-4' : 'p-6';

  return (
    <section className={sectionPadding}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
            For sellers
          </p>
          <h2 className={headingClass}>Selling on Second Turn</h2>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 ${gridGap}`}>
          {VALUE_PROPS.map(({ Icon: ValueIcon, title, body }) => (
            <Card key={title} className={cardPadding}>
              <CardBody className="p-0">
                <ValueIcon
                  size={32}
                  weight="duotone"
                  aria-hidden="true"
                  className="text-semantic-brand"
                />
                <h3 className="text-base font-semibold mt-3 text-semantic-text-heading">
                  {title}
                </h3>
                <p className="text-sm text-semantic-text-muted mt-2 leading-relaxed">
                  {body}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export { SellerValueProp };
export type { SellerValuePropProps };
