import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { BotSubagentProgress } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotTurnLive } from '../components/bot-turn-live';

/**
 * The turn's live line. What breaks this: the line saying "Thinking" for
 * the minutes a provider's backoff takes, so the person cannot tell a slow
 * model from a rate limit; the children of a `delegate` call hidden behind
 * "Running 3 subagents" until all of them end, or a child's tools and state
 * read from anything but the stream's frame.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

afterEach(cleanup);

const delegate: BotToolStep = {
  callId: 'c1',
  name: 'delegate',
  input: { tasks: [{ task: 'a' }, { task: 'b' }, { task: 'c' }] },
  output: null,
  isError: false,
  sessionId: null,
  subagents: null,
  allowedBy: null,
  mailDraft: null,
};

const child = (
  task: string,
  state: BotSubagentProgress['state'],
  toolCalls: string[] = [],
): BotSubagentProgress => ({
  task,
  state,
  toolCalls,
  startedAt: state === 'queued' ? null : '2026-10-29T10:00:00.000Z',
  durationMs: state === 'queued' || state === 'running' ? null : 4_000,
});

describe('BotTurnLive', () => {
  it('hangs each running child under the line, opening to the tools it has called, and counts the ones done', () => {
    render(
      <BotTurnLive
        queued={false}
        step={delegate}
        subagents={[
          child('Check acme/api#12', 'completed', ['get_pull_request']),
          child('Check acme/api#13', 'running', ['list_pull_requests', 'get_pull_request']),
          child('Check acme/api#14', 'timed_out'),
        ]}
        writing={false}
        provider="Anthropic"
        since={null}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain(
      'bots.chat.activity.delegatingDone {"count":3,"done":2}',
    );
    const [, running, timedOut] = screen.getAllByRole('listitem');
    fireEvent.click(within(running as HTMLElement).getByRole('button'));
    expect(running?.textContent).toContain('Check acme/api#13');
    expect(running?.textContent).toContain('List pull requests, Get pull request');
    expect(timedOut?.getAttribute('data-tone')).toBe('danger');
  });

  it('says only what the call is doing when the stream has not told of its children', () => {
    render(
      <BotTurnLive
        queued={false}
        step={delegate}
        subagents={undefined}
        writing={false}
        provider="Anthropic"
        since={null}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('bots.chat.activity.delegating');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('says the provider is limiting requests while the engine waits on it', () => {
    render(
      <BotTurnLive
        queued={false}
        step={undefined}
        subagents={undefined}
        writing={false}
        waitingOn="rate_limit"
        provider="Anthropic"
        since={null}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(
      'bots.chat.turn.retrying.rate_limit {"provider":"Anthropic"}',
    );
  });

  it('says Thinking once it no longer waits', () => {
    render(
      <BotTurnLive
        queued={false}
        step={undefined}
        subagents={undefined}
        writing={false}
        provider="Anthropic"
        since={null}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('bots.chat.turn.thinking');
  });
});
