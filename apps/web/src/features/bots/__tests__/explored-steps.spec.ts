import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { stepExplore, traceRuns } from '../lib/explored-steps';

/**
 * Which of a bot's calls fold into its Explored line, and the runs its
 * trace draws. What breaks this: a call that changes something
 * (`start_session`, `send_mail`) folded in as though it only read; a run
 * carried past a call that acts; the same thing read twice named twice; a
 * run still Exploring once the turn has ended, or when the call in flight
 * is not a read.
 */

const step = (
  callId: string,
  name: string,
  input: Record<string, unknown> = {},
  output: string | null = 'ok',
): BotToolStep => ({
  callId,
  name,
  input,
  output,
  isError: false,
  sessionId: null,
  subagents: null,
  allowedBy: null,
  mailDraft: null,
});

describe('stepExplore', () => {
  it.each([
    ['get_session', 'read', 'session'],
    ['read_mail_thread', 'read', 'mail thread'],
    ['list_pull_requests', 'list', 'pull requests'],
    ['mcp__oppenheimer__list_hosts', 'list', 'hosts'],
    ['recall', 'search', 'recall'],
  ])('reads %s as looking around', (name, verb, label) => {
    expect(stepExplore({ name, input: {} })).toMatchObject({ verb, label });
  });

  it('names a search by what it searched for and a fetch by its site', () => {
    expect(stepExplore({ name: 'web_search', input: { query: 'bun vs node' } })).toMatchObject({
      verb: 'search',
      label: '“bun vs node”',
    });
    expect(stepExplore({ name: 'web_fetch', input: { url: 'https://bun.sh/docs' } })).toMatchObject(
      { verb: 'read', label: 'bun.sh' },
    );
  });

  it.each([
    'start_session',
    'send_mail',
    'update_task',
    'remember',
    'delegate',
    'todo_write',
    'merge_pull_request',
  ])('leaves %s out, since it does more than read', (name) => {
    expect(stepExplore({ name, input: {} })).toBeNull();
  });
});

describe('traceRuns', () => {
  it('cuts the calls where they turn from reading to acting and back', () => {
    const runs = traceRuns(
      [
        step('a', 'get_session'),
        step('b', 'list_hosts'),
        step('c', 'start_session'),
        step('d', 'send_to_session'),
        step('e', 'get_session'),
      ],
      false,
    );
    expect(runs.map((run) => [run.kind, run.steps.map((s) => s.callId).join('')])).toEqual([
      ['explored', 'ab'],
      ['tools', 'cd'],
      ['explored', 'e'],
    ]);
  });

  it('names what was read once, each verb in the order it first came', () => {
    const [run] = traceRuns(
      [
        step('a', 'get_session', { sessionId: '1' }),
        step('b', 'search_mail', { query: 'invoice' }),
        step('c', 'get_session', { sessionId: '2' }),
        step('d', 'read_mail_thread'),
        step('e', 'web_search', { query: 'invoice' }),
      ],
      false,
    );
    expect(run?.kind === 'explored' && run.parts).toEqual([
      { verb: 'read', targets: ['session', 'mail thread'] },
      { verb: 'search', targets: ['mail “invoice”', '“invoice”'] },
    ]);
  });

  it('is Exploring only while the turn runs and the call in flight is one more read', () => {
    const reading = [step('a', 'get_session'), step('b', 'list_hosts', {}, null)];
    expect(traceRuns(reading, true)).toMatchObject([{ kind: 'explored', exploring: true }]);
    expect(traceRuns(reading, false)).toMatchObject([{ kind: 'explored', exploring: false }]);
    const acting = [step('a', 'get_session'), step('b', 'start_session', {}, null)];
    expect(traceRuns(acting, true)).toEqual([
      expect.objectContaining({ kind: 'explored', exploring: false }),
    ]);
  });
});
