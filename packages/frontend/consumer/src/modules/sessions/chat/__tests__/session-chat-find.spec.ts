import { describe, expect, it } from 'vitest';
import type { ChatStep, ChatTurn } from '../session-chat';
import { findInChat } from '../session-chat-find';

/**
 * What the session chat's find bar steps through. The regressions this
 * guards: a match in a folded call or thinking counted (the bar would land
 * on nothing the reader can see), a link's URL counted when the chat shows
 * only its words, case mattering, and a blank query finding every turn.
 */

const reply = (id: string, text: string): ChatStep => ({
  kind: 'reply',
  id,
  at: null,
  text,
  truncated: false,
});

const turn = (id: string, prompt: string | null, steps: ChatStep[]): ChatTurn => ({
  id,
  prompt: prompt === null ? null : { id: `${id}:p`, text: prompt, files: 0, images: [], at: null },
  steps,
  model: null,
  contextTokens: null,
  startedAt: null,
  lastAt: null,
  working: false,
});

const turns = [
  turn('t1', 'Open a PR for the fix', [
    { kind: 'thinking', id: 's1', at: null, text: 'The PR needs a test' },
    reply('s2', 'Opened [the PR](https://github.com/acme/app/pull/58). pr #58 is ready.'),
  ]),
  turn('t2', null, [reply('s3', 'Nothing to merge')]),
  turn('t3', 'merge pr 58', []),
];

describe('findInChat', () => {
  it('finds every match in prompts and replies, in order, ignoring case', () => {
    expect(findInChat(turns, 'pr')).toEqual([
      { turnId: 't1', index: 0 },
      { turnId: 't1', index: 1 },
      { turnId: 't1', index: 2 },
      { turnId: 't3', index: 0 },
    ]);
  });

  it('skips thinking and the target of a markdown link', () => {
    expect(findInChat(turns, 'test')).toEqual([]);
    expect(findInChat(turns, 'github')).toEqual([]);
  });

  it('finds nothing for a blank query', () => {
    expect(findInChat(turns, '   ')).toEqual([]);
  });
});
