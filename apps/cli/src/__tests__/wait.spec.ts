import { describe, expect, it, vi } from 'vitest';
import { scheduleTrigger } from '../commands/automations';
import type { BotConversation, Session } from '../lib/api-types';
import { ApiClient } from '../lib/client';
import { parseDuration, turnOutcome, waitForSessions } from '../lib/wait';

/**
 * `opp sessions wait` is how an agent on one host waits on a helper on
 * another: it must return when the helper is through *or* needs somebody,
 * and give up at its timeout rather than hang a script for ever.
 */

function session(overrides: Partial<Session>): Session {
  return {
    id: 's-1',
    projectId: 'p-1',
    hostId: 'h-1',
    name: 'helper',
    slug: 'helper',
    agent: 'claude-code',
    place: 'worktree',
    state: 'working',
    lifecycle: 'open',
    checkouts: [],
    hints: [],
    decision: null,
    agentReport: null,
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
    ...overrides,
  };
}

describe('waitForSessions', () => {
  it('returns once the session settles', async () => {
    const reads = [session({ state: 'working' }), session({ state: 'idle' })];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(reads.shift())));
    const client = new ApiClient({ apiUrl: 'https://api.example.com', token: 't', fetchImpl });

    const result = await waitForSessions(client, ['s-1'], {
      timeoutMs: 60_000,
      intervalMs: 1_000,
      sleep: async () => {},
    });

    expect(result.settled).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up at the timeout and says the session is still going', async () => {
    let clock = 0;
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(session({ state: 'working' }))),
    );
    const client = new ApiClient({ apiUrl: 'https://api.example.com', token: 't', fetchImpl });

    const result = await waitForSessions(client, ['s-1'], {
      timeoutMs: 10_000,
      intervalMs: 3_000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });

    expect(result.settled).toBe(false);
    expect(result.sessions[0].state).toBe('working');
    expect(clock).toBeLessThanOrEqual(10_000);
  });
});

describe('waitForSessions after a prompt', () => {
  /** A client whose log pages come from this queue, in order, and whose session is always `read`. */
  function scripted(read: Session, logs: { seq: number; kind: string; payload: object }[][]) {
    const sessionReads = vi.fn();
    const fetchImpl = vi.fn(async (url: string) => {
      if (new URL(url).pathname.endsWith('/events')) {
        return new Response(JSON.stringify({ data: logs.shift() ?? [], nextSeq: null }));
      }
      sessionReads();
      return new Response(JSON.stringify(read));
    });
    return {
      client: new ApiClient({ apiUrl: 'https://api.example.com', token: 't', fetchImpl }),
      sessionReads,
    };
  }

  it('does not take the idle state from before the prompt for its outcome', async () => {
    // Codex's review of #618: the prompt leaves the session idle until the
    // agent is seen on it, and the wait used to return right there.
    const { client, sessionReads } = scripted(session({ state: 'idle' }), [
      [],
      [{ seq: 8, kind: 'agent.observed', payload: { state: 'working' } }],
    ]);

    const result = await waitForSessions(client, ['s-1'], {
      timeoutMs: 60_000,
      intervalMs: 1_000,
      sleep: async () => {},
      afterSeq: 7,
    });

    expect(result.settled).toBe(true);
    expect(sessionReads).toHaveBeenCalledTimes(2);
  });

  it('times out on an idle session whose agent never took the prompt', async () => {
    let clock = 0;
    const { client } = scripted(session({ state: 'idle' }), []);

    const result = await waitForSessions(client, ['s-1'], {
      timeoutMs: 9_000,
      intervalMs: 3_000,
      afterSeq: 7,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });

    expect(result.settled).toBe(false);
  });
});

describe('turnOutcome', () => {
  it('shows only this turn’s replies, and an approval it raised that is still pending', () => {
    const conversation: BotConversation = {
      turns: [{ id: 't-2', status: 'running', error: null }],
      messages: [
        { id: 'm-1', turnId: 't-1', role: 'assistant', content: 'an older answer', createdAt: '' },
        { id: 'm-2', turnId: 't-2', role: 'user', content: 'question', createdAt: '' },
        { id: 'm-3', turnId: 't-2', role: 'assistant', content: 'on it', createdAt: '' },
      ],
    };
    const approvals = [
      {
        id: 'a-1',
        turnId: 't-2',
        tool: 'start_session',
        summary: 'Start a session',
        status: 'pending' as const,
      },
      {
        id: 'a-0',
        turnId: 't-1',
        tool: 'start_session',
        summary: 'old',
        status: 'pending' as const,
      },
    ];

    const outcome = turnOutcome(conversation, approvals, 't-2');

    expect(outcome.replies.map((reply) => reply.content)).toEqual(['on it']);
    expect(outcome.pending.map((approval) => approval.id)).toEqual(['a-1']);
  });
});

describe('parseDuration', () => {
  it('reads seconds, minutes and hours, and a bare number as seconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('45')).toBe(45_000);
    expect(() => parseDuration('soon')).toThrow();
  });
});

describe('scheduleTrigger', () => {
  it('sends only the fields a frequency reads, which is what the API accepts', () => {
    expect(scheduleTrigger({ every: 'daily', at: '09:30', timezone: 'Europe/Madrid' })).toEqual({
      source: 'schedule',
      frequency: 'daily',
      hour: 9,
      minute: 30,
      timezone: 'Europe/Madrid',
    });
  });

  it('turns weekday names into the API’s numbers, Sunday first', () => {
    const trigger = scheduleTrigger({
      every: 'weekly',
      at: '8:00',
      on: 'mon,Thursday',
      timezone: 'UTC',
    });
    expect(trigger.days).toEqual([1, 4]);
  });

  it('refuses a weekly schedule with no days and a time that is not one', () => {
    expect(() => scheduleTrigger({ every: 'weekly', at: '08:00' })).toThrow(/--on/);
    expect(() => scheduleTrigger({ every: 'daily', at: '25:00' })).toThrow(/--at/);
  });
});
