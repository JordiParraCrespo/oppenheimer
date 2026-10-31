import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { exploredParts, stepExplore, stepRuns } from '../lib/explored-steps';

/**
 * Which of a bot's calls fold into its Explored line. What breaks this: a
 * call that changes something (`start_session`, `send_mail`) folded in as
 * though it only read; a run carried past a call that acts; the same thing
 * read twice named twice.
 */

const step = (callId: string, name: string, input: Record<string, unknown> = {}): BotToolStep => ({
  callId,
  name,
  input,
  output: 'ok',
  isError: false,
  sessionId: null,
  subagents: null,
  allowedBy: null,
  mailDraft: null,
});

describe('stepExplore', () => {
  it.each([
    ['get_session', { verb: 'read', object: 'session' }],
    ['read_mail_thread', { verb: 'read', object: 'mail thread' }],
    ['list_pull_requests', { verb: 'list', object: 'pull requests' }],
    ['mcp__oppenheimer__list_hosts', { verb: 'list', object: 'hosts' }],
    ['recall', { verb: 'search', object: 'recall' }],
  ])('reads %s as looking around', (name, explore) => {
    expect(stepExplore({ name, input: {} })).toEqual(explore);
  });

  it('names a search by what it searched for and a fetch by its site', () => {
    expect(stepExplore({ name: 'web_search', input: { query: 'bun vs node' } })).toEqual({
      verb: 'search',
      object: '',
      query: 'bun vs node',
    });
    expect(stepExplore({ name: 'web_fetch', input: { url: 'https://bun.sh/docs' } })).toEqual({
      verb: 'read',
      object: 'bun.sh',
    });
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

describe('stepRuns', () => {
  it('cuts the calls where they turn from reading to acting and back', () => {
    const runs = stepRuns([
      step('a', 'get_session'),
      step('b', 'list_hosts'),
      step('c', 'start_session'),
      step('d', 'send_to_session'),
      step('e', 'get_session'),
    ]);
    expect(runs.map((run) => [run.explored, run.steps.map((s) => s.callId).join('')])).toEqual([
      [true, 'ab'],
      [false, 'cd'],
      [true, 'e'],
    ]);
  });
});

describe('exploredParts', () => {
  it('names what was read once, each verb in the order it first came', () => {
    expect(
      exploredParts([
        step('a', 'get_session', { sessionId: '1' }),
        step('b', 'search_mail', { query: 'invoice' }),
        step('c', 'get_session', { sessionId: '2' }),
        step('d', 'read_mail_thread'),
        step('e', 'web_search', { query: 'invoice' }),
      ]),
    ).toEqual([
      { verb: 'read', targets: ['session', 'mail thread'] },
      { verb: 'search', targets: ['mail “invoice”', '“invoice”'] },
    ]);
  });
});
