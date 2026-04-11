import { CheckCircle } from '@phosphor-icons/react/ssr';

interface StepItem {
  id: string;
  label: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: string;
  className?: string;
}

function Stepper({ steps, currentStep, className }: StepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  if (currentIndex === -1) return null;

  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step.id} className="flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-1.5 w-full rounded-full transition-colors duration-250 ease-out-custom ${
                    isCompleted || isCurrent
                      ? 'bg-semantic-brand'
                      : 'bg-semantic-border-subtle'
                  }`}
                />
                <span
                  className={`text-xs hidden sm:flex items-center gap-1 ${
                    isCurrent
                      ? 'font-medium text-semantic-text-primary'
                      : isCompleted
                        ? 'text-semantic-text-secondary'
                        : 'text-semantic-text-muted'
                  }`}
                >
                  {isCompleted && <CheckCircle size={14} weight="fill" className="text-semantic-brand" aria-hidden="true" />}
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-semantic-text-muted mt-2 sm:hidden">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex].label}
      </p>
    </nav>
  );
}

export { Stepper };
export type { StepperProps, StepItem };
