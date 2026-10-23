import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownLine } from './markdown';

/**
 * A bot's last message previews in the sidebar as words, not as markdown. The
 * regressions this guards: `**` and backticks on screen, and a link nested
 * inside the row's own link.
 */

afterEach(cleanup);

const line = (source: string) => render(<MarkdownLine source={source} />).container;

describe('MarkdownLine', () => {
  it('reads bold, code and a link as elements and words, not syntax', () => {
    const page = line(
      'Opened **[#430 — Notifications](https://github.com/o/r/pull/430)** for `create`.',
    );
    expect(page.textContent).toBe('Opened #430 — Notifications for create.');
    expect(page.querySelector('strong')?.textContent).toBe('#430 — Notifications');
    expect(page.querySelector('code')?.textContent).toBe('create');
    expect(page.querySelector('a')).toBeNull();
  });

  it('flattens blocks onto one line and drops what has no words', () => {
    const page = line('## Done\n\n- shipped <script>x()</script>');
    expect(page.querySelector('h2, ul, li, script')).toBeNull();
    expect(page.textContent).toContain('Done');
    expect(page.textContent).toContain('shipped');
  });
});
