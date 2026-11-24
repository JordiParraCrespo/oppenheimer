import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotFormCard } from '../sections/bot-form-card';

/**
 * The card for a form a bot waits on. What breaks this: the request for the
 * waiting form failing and the chat drawing nothing, so the bot waits on a
 * form nobody can see or fill, and no way to ask again.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({ error: null as Error | null, refetch: vi.fn() }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotPendingForm: () => ({
    data: undefined,
    error: state.error,
    isFetching: false,
    refetch: state.refetch,
  }),
  useSubmitBotForm: () => ({ mutate: vi.fn(), error: null, reset: vi.fn() }),
  useDismissBotForm: () => ({ mutate: vi.fn(), error: null, reset: vi.fn() }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: ({ fallback, action }: { fallback: string; action?: React.ReactNode }) => (
    <div role="alert">
      {fallback}
      {action}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  state.error = null;
  state.refetch.mockReset();
});

describe('BotFormCard', () => {
  it('says the waiting form could not be read, and reads it again on Retry', () => {
    state.error = new Error('offline');
    render(<BotFormCard botId="bot-1" name="Release Bro" />);
    expect(screen.getByRole('alert').textContent).toContain('bots.chat.form.loadFailed');
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it('draws nothing while no form waits', () => {
    const { container } = render(<BotFormCard botId="bot-1" name="Release Bro" />);
    expect(container.innerHTML).toBe('');
  });
});
