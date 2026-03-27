import Link from 'next/link';
import { CheckCircle, Circle, CaretRight } from '@phosphor-icons/react/ssr';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui';
import type { OnboardingState } from '@/lib/services/onboarding';
import { DismissOnboardingButton } from './DismissOnboardingButton';

interface OnboardingChecklistProps {
  state: OnboardingState;
}

export function OnboardingChecklist({ state }: OnboardingChecklistProps) {
  if (state.dismissed) return null;

  const completedCount = state.items.filter((item) => item.complete).length;
  const totalCount = state.items.length;
  const allComplete = completedCount === totalCount;
  const progressPercent = (completedCount / totalCount) * 100;

  if (allComplete) {
    return (
      <Card className="mb-6">
        <CardBody className="text-center py-6">
          <CheckCircle
            size={40}
            weight="fill"
            className="text-semantic-primary mx-auto mb-3"
          />
          <p className="text-lg font-semibold text-semantic-text-heading mb-1">
            You are all set
          </p>
          <p className="text-sm text-semantic-text-muted mb-4">
            Welcome to Second Turn Games.
          </p>
          <DismissOnboardingButton label="Got it" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-semantic-text-heading">
            Getting started
          </h2>
          <span className="text-sm text-semantic-text-muted">
            {completedCount} of {totalCount} complete
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-semantic-border-subtle overflow-hidden">
          <div
            className="h-full rounded-full bg-semantic-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>

      <CardBody className="py-2">
        <ul className="divide-y divide-semantic-border-subtle">
          {state.items.map((item) => (
            <li key={item.id}>
              {item.complete ? (
                <div className="flex items-center gap-3 py-3 px-1">
                  <CheckCircle
                    size={24}
                    weight="fill"
                    className="text-semantic-primary shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-semantic-text-muted line-through">
                      {item.label}
                    </p>
                  </div>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 py-3 px-1 group"
                >
                  <Circle
                    size={24}
                    className="text-semantic-text-muted shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-semantic-text-primary group-active:text-semantic-primary sm:group-hover:text-semantic-primary">
                      {item.label}
                    </p>
                    <p className="text-xs text-semantic-text-muted mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <CaretRight
                    size={16}
                    className="text-semantic-text-muted shrink-0"
                  />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardBody>

      <CardFooter className="flex items-center justify-between">
        <Link
          href="/browse"
          className="text-sm text-semantic-text-muted active:text-semantic-primary sm:hover:text-semantic-primary transition-colors"
        >
          Or start by browsing pre-loved games
        </Link>
        <DismissOnboardingButton />
      </CardFooter>
    </Card>
  );
}
