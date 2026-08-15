import type { Thing, WithContext } from 'schema-dts';

interface JsonLdProps {
  data: WithContext<Thing> | WithContext<Thing>[];
}

/**
 * Renders schema.org structured data as `application/ld+json`.
 *
 * Each node object gets its **own** `<script>` tag rather than one script
 * holding a top-level JSON array. Both forms are valid JSON-LD (a top-level
 * array of node objects is spec-legal), but array-naive consumers that do
 * `JSON.parse(script.textContent)['@context']` read `undefined` off an array
 * and blow up on the next property access. That is the exact shape behind
 * Sentry STG-MARKETPLACE-1P / -1R / -1S — a third-party script scanning our
 * ld+json blocks threw `TypeError: undefined is not an object (evaluating
 * 'r["@context"].toLowerCase')` on every page rendering the root layout's
 * two-node array. Emitting one object per tag keeps us spec-correct and
 * removes the trigger.
 */
export function JsonLd({ data }: JsonLdProps) {
  const nodes = Array.isArray(data) ? data : [data];

  return (
    <>
      {nodes.map((node, index) => (
        <script
          // Static, never reordered — index is a stable identity here.
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  );
}
