// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AnnouncementMarkdown } from './AnnouncementMarkdown';

afterEach(() => cleanup());

describe('AnnouncementMarkdown sanitize config', () => {
  it('strips <script> tags', () => {
    const { container } = render(<AnnouncementMarkdown body={'<script>alert(1)</script>'} />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('strips <img> tags rendered from markdown image syntax', () => {
    const { container } = render(
      <AnnouncementMarkdown body={'![alt](https://example.com/foo.png)'} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('strips raw HTML <style> tags', () => {
    const { container } = render(
      <AnnouncementMarkdown body={'<style>body { display: none; }</style>'} />,
    );
    expect(container.querySelector('style')).toBeNull();
  });

  it('strips javascript: URLs on links', () => {
    const { container } = render(
      <AnnouncementMarkdown body={'[click](javascript:alert(1))'} />,
    );
    const link = container.querySelector('a');
    // rehype-sanitize either removes the href or rewrites it; neither should
    // be a javascript: URL when rendered.
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });

  it('demotes h1 → h2 so the page H1 (announcement title) stays unique', () => {
    const { container } = render(
      <AnnouncementMarkdown body={'# Big idea\n\n## Sub heading'} />,
    );
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelectorAll('h2').length).toBe(1);
    expect(container.querySelectorAll('h3').length).toBe(1);
  });

  it('allows bold, italic, links, code, and lists', () => {
    const body =
      '**bold** and *italic*, with [a link](https://example.com) and `code`\n\n- item one\n- item two';
    const { container } = render(<AnnouncementMarkdown body={body} />);
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelector('em')).not.toBeNull();
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(container.querySelector('code')).not.toBeNull();
    expect(container.querySelectorAll('li').length).toBe(2);
  });
});
