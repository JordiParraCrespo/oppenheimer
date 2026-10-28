import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatToolOutput } from './chat-tool-output';

/**
 * A tool's answer in the chat has no Raw view to fall back on, so the tree
 * must show every value the tool returned. The regressions this guards: an
 * empty object or array drawn as nothing, and the members past a level's
 * first 200 replaced by a count no one can open.
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
  });
});
