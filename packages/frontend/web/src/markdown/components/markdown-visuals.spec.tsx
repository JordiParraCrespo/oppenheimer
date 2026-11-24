import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { markdownText } from '../lib/markdown';
import { Markdown, MarkdownLine } from './markdown';

/**
 * A reply's diagrams and formulas draw, and nothing else does. The
 * regressions this guards: a price read as TeX ("$5 and $10" typeset as
 * math), a chat's own code renderer swallowing a `mermaid` fence, a diagram
 * drawn from a fence still being written, and bad input shown as an error
 * instead of its source.
 */

afterEach(cleanup);

const F = '```';
const chatCode = ({ code, language }: { code: string; language: string | undefined }) => (
  <pre data-chat-code={language ?? ''}>{code}</pre>
);
const view = (source: string) => render(<Markdown source={source} code={chatCode} />).container;

describe('Markdown math', () => {
  it('reads prices as prices, never as math', () => {
    for (const source of [
      'It costs $5 and $10 today.',
      'From US$5 to US$10.',
      'Either $5,$10 or $20-$30.',
      'A dollar is \\$x$ here.',
      'Spaces $ x $ are not math.',
    ]) {
      const page = view(source);
      expect(page.querySelector('[data-slot=markdown-math], code')).toBeNull();
      expect(page.textContent).toContain('$');
      cleanup();
    }
  });

  it('typesets $…$ in a line and $$…$$ as a block, once KaTeX has loaded', async () => {
    const page = view('Euler: $e^{i\\pi}+1=0$.\n\n$$\n\\int_0^1 x\\,dx\n$$');
    await waitFor(() => expect(page.querySelectorAll('.katex')).toHaveLength(2));
    expect(page.querySelector('p .katex')).not.toBeNull();
    expect(page.querySelector('div[data-slot=markdown-math] .katex-display')).not.toBeNull();
    expect(page.textContent).not.toContain('$');
  });

  it('typesets a closed math fence, ahead of the caller’s code renderer', async () => {
    const page = view(`${F}math\n\\frac{1}{2}\n${F}`);
    await waitFor(() => expect(page.querySelector('.katex-display')).not.toBeNull());
    expect(page.querySelector('[data-chat-code]')).toBeNull();
  });

  it('shows TeX KaTeX cannot read as code, never an error', async () => {
    const page = view('Broken: $\\frac{1}{$ and $x^2$.\n\n$$\n\\begin{matrix} a \\end{oops}\n$$');
    // The good formula proves KaTeX has loaded before the bad ones are judged.
    await waitFor(() => expect(page.querySelector('.katex')).not.toBeNull());
    expect(page.querySelector('p code')?.textContent).toBe('\\frac{1}{');
    expect(page.querySelector('[data-chat-code=math]')?.textContent).toBe(
      '\\begin{matrix} a \\end{oops}',
    );
    expect(page.querySelector('.katex-error')).toBeNull();
  });

  it('previews a formula on one line as its TeX in a code span', () => {
    const page = render(<MarkdownLine source="Area is $\frac{1}{3}$ for $5 and $10." />).container;
    expect(page.querySelector('code')?.textContent).toBe('\\frac{1}{3}');
    expect(page.querySelector('.katex')).toBeNull();
    expect(page.textContent).toContain('$5 and $10');
  });

  it('counts a formula’s TeX among the words a find searches', () => {
    expect(markdownText('Area $x^2$ here.')).toBe('\nArea x^2 here.\n');
  });
});

describe('Markdown diagrams', () => {
  const diagram = `${F}mermaid\nflowchart LR\n  A --> B\n${F}`;

  it('draws a closed mermaid fence itself, before the caller’s code renderer sees it', () => {
    const page = view(diagram);
    expect(page.querySelector('[data-slot=markdown-diagram]')).not.toBeNull();
    expect(page.querySelector('[data-slot=markdown-diagram] [aria-busy]')).not.toBeNull();
    expect(page.querySelector('[data-chat-code]')).toBeNull();
  });

  it('keeps a fence still being written as code, and draws it once it closes', () => {
    const { container, rerender } = render(
      <Markdown
        source={`${F}mermaid\nflowchart LR\n  A --> B\n${F.slice(0, 2)}`}
        code={chatCode}
      />,
    );
    expect(container.querySelector('[data-chat-code=mermaid]')).not.toBeNull();
    expect(container.querySelector('[data-slot=markdown-diagram]')).toBeNull();
    rerender(<Markdown source={diagram} code={chatCode} />);
    expect(container.querySelector('[data-slot=markdown-diagram]')).not.toBeNull();
  });

  it('leaves every other fence to the caller’s code renderer', () => {
    const page = view(`${F}ts\nconst a = 1;\n${F}\n\n    indented mermaid`);
    expect(page.querySelectorAll('[data-chat-code]')).toHaveLength(2);
    expect(page.querySelector('[data-slot=markdown-diagram]')).toBeNull();
  });

  it('shows a source Mermaid cannot read as its code block with a note, never an error', async () => {
    const page = view(`${F}mermaid\nflowchart LR\n  A --> B -->\n  this is not ((( mermaid\n${F}`);
    await waitFor(() => expect(page.querySelector('[data-chat-code=mermaid]')).not.toBeNull(), {
      timeout: 10_000,
    });
    expect(page.querySelector('[data-chat-code=mermaid]')?.textContent).toContain('((( mermaid');
    expect(page.textContent).toContain('common.markdown.diagram.unreadable');
    expect(page.querySelector('svg[aria-roledescription=error], img')).toBeNull();
  });
});
