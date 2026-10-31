import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotTrace } from '../components/bot-trace';

/**
 * A run of tool calls as the chat's trace. What breaks this: Open session
 * read from a call's words rather than the session the call recorded, so a
 * reworded answer loses the link, or the link drawn away from its step;
 * calls made together drawn as loose lines instead of one folded group;
 * read-only calls folded with ones that change something, or named twice
 * when the same thing was read twice; a long output drawn whole in the
 * compact view, or cut with no way to the rest.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
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
  subagents: null,
  allowedBy: null,
  mailDraft: null,
  ...overrides,
});

describe('BotTrace', () => {
  it('opens the session a call started from that call’s own line, in a new tab', () => {
    render(
      <BotTrace
        steps={[step('a', { sessionId: SESSION }), step('b', { name: 'send_to_session' })]}
      />,
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

  it('draws a delegate call’s subagents under its line, each opening to its answer, a failed one in red', () => {
    const run = (task: string, status: 'completed' | 'timed_out', result: string) => ({
      task,
      status,
      result,
      toolCalls: ['get_pull_request'],
      inputTokens: 900,
      outputTokens: 100,
      durationMs: 12_400,
    });
    render(
      <BotTrace
        steps={[
          step('a', {
            name: 'delegate',
            input: { tasks: [{ task: 'Check #12' }, { task: 'Check #13' }] },
            subagents: [
              run('Check #12', 'completed', 'Checks pass.'),
              run('Check #13', 'timed_out', 'Stopped after 90 seconds, its limit.'),
            ],
          }),
        ]}
      />,
    );
    const line = screen.getByRole('button', { name: /bots\.chat\.activity\.delegated/ });
    expect(line.textContent).toContain('bots.chat.activity.groupFailed');
    fireEvent.click(line);
    const children = screen.getAllByRole('listitem').slice(1);
    expect(children.map((child) => child.getAttribute('data-tone'))).toEqual(['default', 'danger']);
    fireEvent.click(within(children[0] as HTMLElement).getByRole('button', { name: /Check #12/ }));
    expect(screen.getByText('Checks pass.')).toBeTruthy();
  });

  it('folds read-only calls into one Explored line naming each thing once, which another call ends', () => {
    render(
      <BotTrace
        steps={[
          step('a', { name: 'get_session', input: { sessionId: 's1' } }),
          step('b', { name: 'list_hosts' }),
          step('c', { name: 'get_session', input: { sessionId: 's2' } }),
          step('d', { name: 'search_mail', input: { query: 'invoice' } }),
          step('e', { name: 'start_session' }),
        ]}
      />,
    );
    const explored = screen.getByRole('button', { name: /bots\.chat\.activity\.explored/ });
    expect(explored.textContent).toContain('common.chat.explored.read session');
    expect(explored.textContent?.match(/session/g)).toHaveLength(1);
    expect(explored.textContent).toContain('common.chat.explored.list hosts');
    expect(explored.textContent).toContain('common.chat.explored.search mail “invoice”');
    // The call that acts is its own line after the group.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(explored);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('says Exploring while the call in flight is one more read', () => {
    const steps = [
      step('a', { name: 'get_session' }),
      step('b', { name: 'list_hosts', output: null }),
    ];
    const { rerender } = render(<BotTrace steps={steps} live />);
    expect(screen.getByRole('button', { name: /bots\.chat\.activity\.exploring/ })).toBeTruthy();
    rerender(<BotTrace steps={steps} />);
    expect(screen.queryByRole('button', { name: /exploring/ })).toBeNull();
  });

  it('shows the first lines of a long output, cuts a long line to its head and tail, and opens the rest', () => {
    const long = `${'a'.repeat(300)}END`;
    const output = [long, ...Array.from({ length: 11 }, (_, i) => `line ${i + 2}`)].join('\n');
    render(<BotTrace steps={[step('a', { name: 'send_to_session', output })]} />);
    fireEvent.click(screen.getByRole('button', { name: /Send to session/ }));
    expect(screen.queryByText('line 6')).toBeNull();
    expect(screen.getByText(/ … a+END$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.activity.moreLines' }));
    expect(screen.getByText('line 12')).toBeTruthy();
    expect(screen.getByText(long)).toBeTruthy();
  });

  it('offers no link for a call that recorded no session, whatever its words say', () => {
    render(<BotTrace steps={[step('a', { output: `Started session ${SESSION} on host h-1.` })]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
