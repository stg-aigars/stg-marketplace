import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

function Card({ hoverable, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-semantic-bg-elevated rounded-lg border border-semantic-border-subtle shadow-sm ${hoverable ? 'transition-shadow active:shadow-md sm:hover:shadow-md' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-3 border-b border-semantic-border-subtle ${className}`} {...props}>
      {children}
    </div>
  );
}

function CardBody({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-3 border-t border-semantic-border-subtle ${className}`} {...props}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter };
export type { CardProps };
