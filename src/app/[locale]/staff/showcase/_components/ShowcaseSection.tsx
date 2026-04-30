interface ShowcaseSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ShowcaseSection({ id, title, description, children }: ShowcaseSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 pb-12"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}
    >
      <h2
        data-showcase-heading={id}
        className="text-xl font-bold font-platform tracking-tight text-semantic-text-heading mb-1"
      >
        {title}
      </h2>
      {description && (
        <p className="text-sm text-semantic-text-muted mb-4">{description}</p>
      )}
      <div className="space-y-6 mt-4">{children}</div>
    </section>
  );
}
