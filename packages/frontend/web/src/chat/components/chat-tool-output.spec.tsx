import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatToolOutput } from './chat-tool-output';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key} ${options.count}`,
    i18n: { language: 'en', resolvedLanguage: 'en', exists: () => false },
  }),
}));

/**
 * A tool's answer in the chat has no Raw view to fall back on, so the tree
 * must show every value the tool returned. The regressions this guards: an
 * empty object or array drawn as nothing, and the members past a level's
 * first 200 replaced by a count no one can open. Text is compact: a long
 * output drawn whole, or cut with no way back to the rest, is what the
 * "+N lines" cases guard.
 */

afterEach(cleanup);

describe('ChatToolOutput', () => {
  it('shows an empty object or array the tool returned', () => {
    const { container, rerender } = render(<ChatToolOutput text="{}" />);
    expect(container.textContent).toBe('{}');
    rerender(<ChatToolOutput text="[]" />);
    expect(container.textContent).toBe('[]');
  });

  it('keeps the members past the first 200 one click away', () => {
    const numbers = Array.from({ length: 201 }, (_, index) => index * 7);
    const { container } = render(<ChatToolOutput text={JSON.stringify(numbers)} />);
    expect(container.textContent).not.toContain('1400');
    fireEvent.click(screen.getByRole('button', { name: /1/ }));
    expect(container.textContent).toContain('1400');
  });

  it('leaves output that is not JSON as its text', () => {
    const { container } = render(<ChatToolOutput text={'PASS  wallet.spec.ts\n1 passed'} />);
    expect(container.textContent).toBe('PASS  wallet.spec.ts\n1 passed');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the first five lines of a long output and opens the rest from "+N lines"', () => {
    const text = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n');
    const { container } = render(<ChatToolOutput text={text} />);
    expect(container.textContent).toContain('line 5');
    expect(container.textContent).not.toContain('line 6');
    const more = screen.getByRole('button', { name: 'common.chat.output.more 7' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(container.textContent).toContain('line 12');
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.output.less' }));
    expect(container.textContent).not.toContain('line 6');
  });

  it('cuts a line too long to read to its head and tail, keeping the whole line one click away', () => {
    const line = `start${'x'.repeat(500)}finish`;
    const { container } = render(<ChatToolOutput text={line} />);
    expect(container.textContent).toMatch(/^startx+ … x+finish/);
    expect(container.textContent?.length).toBeLessThan(line.length);
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.output.full' }));
    expect(container.textContent).toContain(line);
  });
});
