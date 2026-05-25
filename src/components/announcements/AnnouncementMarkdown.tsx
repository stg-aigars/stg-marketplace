import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeShiftHeading from 'rehype-shift-heading';

// Sanitize whitelist: explicitly excludes <img>, <style>, <script>, and any
// raw HTML. Staff content goes anon-readable — any XSS hole exposes every
// visitor. Sanitize config is the load-bearing security boundary; XSS regression
// tests in AnnouncementMarkdown.test.tsx pin this shape.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['rel', 'noopener', 'noreferrer'],
      ['target', '_blank'],
    ],
  },
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (t) => !['img', 'style', 'script'].includes(t),
  ),
};

interface AnnouncementMarkdownProps {
  body: string;
}

export function AnnouncementMarkdown({ body }: AnnouncementMarkdownProps) {
  return (
    <div className="prose prose-sm sm:prose-base max-w-none prose-headings:font-semibold prose-headings:text-semantic-text-heading prose-a:text-semantic-brand-active prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown
        rehypePlugins={[
          [rehypeShiftHeading, { shift: 1 }],
          [rehypeSanitize, sanitizeSchema],
        ]}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
