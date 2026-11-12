import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotMessageText } from '../components/bot-message-text';

/**
 * A long message you sent, folded in the chat. What breaks this: a pasted
 * log of a thousand lines drawn whole in its card, a fold that cannot be
 * opened, or a short message given a Show all it does not need.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.count ? `${key}:${values.count}` : key,
  }),
}));

afterEach(cleanup);

const log = Array.from({ length: 1000 }, (_, line) => `line ${line + 1}`).join('\n');

describe('BotMessageText', () => {
  it('shows a long message folded to its first lines, and opens it whole', () => {
    const { container } = render(<BotMessageText text={log} />);

    expect(container.textContent).toContain('line 12');
    expect(container.textContent).not.toContain('line 13');
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.fold.showAll:1000' }));
    expect(container.textContent).toContain('line 1000');
    expect(screen.getByRole('button', { name: 'bots.chat.fold.showLess' })).toBeTruthy();
  });

  it('shows a short message whole, with nothing to open', () => {
    const { container } = render(<BotMessageText text={'two\nlines'} />);

    expect(container.textContent).toBe('two\nlines');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
