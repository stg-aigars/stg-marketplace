import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, Badge } from '@/components/ui';
import {
  DISPUTE_RESOLUTION_TEMPLATES,
  DSA_STATEMENT_TEMPLATES,
} from '@/lib/staff-templates';

export const metadata: Metadata = {
  title: 'Templates — Staff',
};

interface TemplateGroupProps {
  title: string;
  description: string;
  surface: string;
  surfaceHref: string;
  templates: Array<{ key: string; label: string; body: string }>;
}

function TemplateGroup({ title, description, surface, surfaceHref, templates }: TemplateGroupProps) {
  return (
    <section className="space-y-3">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            {title}
          </h2>
          <Link href={surfaceHref} className="text-sm link-brand">
            {surface}
          </Link>
        </div>
        <p className="text-sm text-semantic-text-muted mt-1">{description}</p>
      </div>

      <div className="space-y-2">
        {templates.map((template) => (
          <Card key={template.key}>
            <CardBody>
              <div className="flex flex-wrap items-baseline gap-2 mb-2">
                <h3 className="text-base font-semibold text-semantic-text-heading">
                  {template.label}
                </h3>
                <code className="font-mono text-xs text-semantic-text-muted">{template.key}</code>
              </div>
              {template.body ? (
                <p className="text-sm text-semantic-text-secondary whitespace-pre-wrap">
                  {template.body}
                </p>
              ) : (
                <p className="text-sm text-semantic-text-muted italic">
                  Empty body — selecting this option clears the textarea so staff can write from scratch.
                </p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function StaffTemplatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
            Staff templates
          </h1>
          <Badge variant="default">Read-only</Badge>
        </div>
        <p className="text-sm text-semantic-text-secondary max-w-2xl">
          Canned text used when staff resolves disputes or actions DSA notices.
          Surfaced as a Select on the relevant detail surfaces — staff selects,
          edits if needed, then submits. The wording is legally relevant copy,
          so editing happens via pull request (git history + PR review) rather
          than a UI editor; changes ship the moment the deploy lands. To
          propose an addition or wording change, open a PR against{' '}
          <code className="font-mono text-xs">src/lib/staff-templates/</code>.
        </p>
      </div>

      <TemplateGroup
        title="Dispute resolution"
        description="Prefills the staff-notes textarea on the dispute detail page. Sent only to the audit log; not surfaced to the buyer or seller."
        surface="Used on /staff/disputes/[id]"
        surfaceHref="/staff/disputes"
        templates={DISPUTE_RESOLUTION_TEMPLATES}
      />

      <TemplateGroup
        title="DSA Article 17 statement-of-reasons"
        description="Prefills the reason-for-the-seller textarea on the &ldquo;Action listing&rdquo; modal at /staff/notices. The seller receives this exact text via in-app notification + email."
        surface="Used on /staff/notices"
        surfaceHref="/staff/notices"
        templates={DSA_STATEMENT_TEMPLATES}
      />
    </div>
  );
}
