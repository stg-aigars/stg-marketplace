// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Thing, WithContext } from 'schema-dts';
import { JsonLd } from './json-ld';

afterEach(() => cleanup());

const ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Second Turn Games',
} as WithContext<Thing>;

const SITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Second Turn Games',
} as WithContext<Thing>;

function scripts(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll('script[type="application/ld+json"]')
  );
}

describe('JsonLd', () => {
  it('renders a single script for a single node object', () => {
    const { container } = render(<JsonLd data={ORG} />);
    expect(scripts(container)).toHaveLength(1);
  });

  it('renders one script per node when given an array', () => {
    const { container } = render(<JsonLd data={[ORG, SITE]} />);
    expect(scripts(container)).toHaveLength(2);
  });

  // The regression guard: a top-level JSON array is spec-legal but breaks
  // array-naive consumers reading `parsed['@context']`. Every emitted block
  // must parse to an object carrying its own @context.
  it('emits no top-level JSON arrays — every block parses to a node object', () => {
    const { container } = render(<JsonLd data={[ORG, SITE]} />);

    for (const script of scripts(container)) {
      const parsed = JSON.parse(script.textContent ?? '');
      expect(Array.isArray(parsed)).toBe(false);
      expect(parsed['@context']).toBe('https://schema.org');
    }
  });

  it('preserves each node payload verbatim', () => {
    const { container } = render(<JsonLd data={[ORG, SITE]} />);
    const parsed = scripts(container).map((s) =>
      JSON.parse(s.textContent ?? '')
    );
    expect(parsed).toEqual([ORG, SITE]);
  });

  it('escapes < to prevent breaking out of the script tag', () => {
    const { container } = render(
      <JsonLd
        data={
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: '</script><script>alert(1)</script>',
          } as WithContext<Thing>
        }
      />
    );

    const [script] = scripts(container);
    expect(script.textContent).not.toContain('</script>');
    expect(script.textContent).toContain('\\u003c');
    // Escaping must survive a round-trip — the parsed value is unchanged.
    expect(JSON.parse(script.textContent ?? '').name).toBe(
      '</script><script>alert(1)</script>'
    );
  });
});
