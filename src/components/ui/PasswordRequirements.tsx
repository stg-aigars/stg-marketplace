import { CheckCircle, Circle } from '@phosphor-icons/react/ssr';
import { checkPasswordRules } from '@/lib/auth/password-validation';
import { cn } from '@/lib/cn';

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({
  password,
  className,
}: PasswordRequirementsProps) {
  const rules = checkPasswordRules(password);
  const allMet = rules.every((r) => r.met);

  if (allMet) {
    return (
      <p
        className={cn(
          'mt-1.5 flex items-center gap-1.5 text-sm text-semantic-success',
          className
        )}
      >
        <CheckCircle size={16} weight="fill" aria-hidden="true" />
        Looks good
      </p>
    );
  }

  return (
    <ul
      className={cn('mt-1.5 space-y-1', className)}
      aria-label="Password requirements"
    >
      {rules.map((rule) => (
        <li key={rule.id} className="flex items-center gap-1.5 text-sm">
          {rule.met ? (
            <CheckCircle
              size={16}
              weight="fill"
              className="text-semantic-success"
              aria-hidden="true"
            />
          ) : (
            <Circle
              size={16}
              className="text-semantic-text-muted"
              aria-hidden="true"
            />
          )}
          <span
            className={
              rule.met
                ? 'text-semantic-text-secondary'
                : 'text-semantic-text-muted'
            }
          >
            {rule.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
