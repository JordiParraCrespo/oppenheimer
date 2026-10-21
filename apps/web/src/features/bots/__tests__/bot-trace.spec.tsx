import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotTrace } from '../components/bot-trace';

/**
 * A run of tool calls as the chat's trace. What breaks this: Open session
 * read from a call's words rather than the session the call recorded, so a
 * reworded answer loses the link, or the link drawn away from its step;
 * calls made together drawn as loose lines instead of one folded group.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const SESSION = '0b6c3f0e-5a7d-4c1e-9f2a-1d2e3f4a5b6c';

const step = (callId: string, overrides: Partial<BotToolStep> = {}): BotToolStep => ({
  callId,
  name: 'start_session',
  input: {},
  output: 'The agent is on it.',
  isError: false,
  sessionId: null,
  ...overrides,
});

describe('BotTrace', () => {
  it('opens the session a call started from that call’s own line, in a new tab', () => {
    render(
      <BotTrace steps={[step('a', { sessionId: SESSION }), step('b', { name: 'get_session' })]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /bots\.chat\.activity\.group/ }));
    const [started, other] = screen.getAllByRole('listitem');
    const link = within(started).getByRole('link', { name: /bots\.chat\.openSession/ });
    expect(link.getAttribute('href')).toBe(`/sessions/${SESSION}`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(within(other).queryByRole('link')).toBeNull();
  });

  it('folds calls made together into one line that opens to a row each', () => {
    render(<BotTrace steps={[step('a'), step('b', { isError: true }), step('c')]} />);
    const summary = screen.getByRole('button', { name: /bots\.chat\.activity\.group/ });
    expect(summary.textContent).toContain('bots.chat.activity.groupFailed');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    fireEvent.click(summary);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('offers no link for a call that recorded no session, whatever its words say', () => {
    render(<BotTrace steps={[step('a', { output: `Started session ${SESSION} on host h-1.` })]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
