import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownBody } from '../components/markdown-body';

/**
 * A pull request's description renders the way GitHub's author meant it,
 * read the way the Codex desktop app reads it, and never lets GitHub's text
 * into the page as markup. The regressions this guards: Markdown shown as its
 * own syntax (`**`, `| --- |`), a template's comments on screen, and HTML or a
 * `javascript:` link from a description reaching the DOM.
 */

afterEach(cleanup);

const view = (source: string) => render(<MarkdownBody source={source} />).container;

describe('MarkdownBody', () => {
  it('renders emphasis, links, nested lists and tables as elements, not syntax', () => {
    const page = view(
      [
        'Follow-up to [#246](https://github.com/o/r/pull/246). **One table** lists it.',
        '',
        '- **Console**',
        '  - polls `stand down`',
        '',
        '| Job | Result |',
        '| --- | --- |',
        '| lint | ✅ |',
      ].join('\n'),
    );
    expect(page.textContent).not.toContain('**');
    expect(page.textContent).not.toContain('---');
    expect(page.querySelector('a')?.getAttribute('href')).toBe('https://github.com/o/r/pull/246');
    expect(page.querySelector('a')?.getAttribute('rel')).toBe('noreferrer');
    expect(page.querySelector('p strong')?.textContent).toBe('One table');
    expect(page.querySelector('ul ul code')?.textContent).toBe('stand down');
    expect([...page.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual([
      'Job',
      'Result',
    ]);
    expect(page.querySelector('td')?.getAttribute('data-col-size')).toBe('sm');
  });

  it('drops the template’s comments, folds details and names an alert', () => {
    const page = view(
      [
        '<!-- Describe your change -->',
        '> [!WARNING]',
        '> Runs a migration.',
        '',
        '<details open>',
        '<summary>Local <b>CI</b></summary>',
        '',
        'All green.',
        '</details>',
      ].join('\n'),
    );
    expect(page.textContent).not.toContain('Describe your change');
    expect(page.querySelector('blockquote strong')?.textContent).toBe('Warning');
    const details = page.querySelector('details');
    expect(details?.open).toBe(true);
    expect(details?.querySelector('summary')?.textContent).toBe('Local CI');
    expect(details?.querySelector('p')?.textContent).toBe('All green.');
  });

  it('keeps basic inline tags and drops every other piece of HTML', () => {
    const page = view(
      [
        'Press <kbd>⌘</kbd> <b>now</b> <span onclick="x()">or</span> later.',
        '',
        '<script>alert(1)</script>',
        '',
        '[click](javascript:alert(1))',
      ].join('\n'),
    );
    expect(page.querySelector('kbd')?.textContent).toBe('⌘');
    expect(page.querySelector('b')?.textContent).toBe('now');
    expect(page.querySelector('script, span[onclick]')).toBeNull();
    expect(page.querySelector('a')).toBeNull();
    expect(page.textContent).toContain('click');
  });

  it('leaves fenced code exactly as written', () => {
    const code = '<!-- kept -->\n<details><summary>x</summary>y</details>';
    const page = view(`\`\`\`html\n${code}\n\`\`\``);
    expect(page.querySelector('pre code')?.textContent).toBe(code);
  });

  it('shows a task list as checkboxes that cannot be changed', () => {
    const boxes = view('- [x] done\n- [ ] todo').querySelectorAll('input[type=checkbox]');
    expect([...boxes].map((box) => (box as HTMLInputElement).checked)).toEqual([true, false]);
    expect([...boxes].every((box) => (box as HTMLInputElement).disabled)).toBe(true);
  });
});
