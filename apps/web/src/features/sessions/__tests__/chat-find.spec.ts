// @vitest-environment node
import type { ChatStep, ChatTurn } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { findInChat } from '../lib/chat-find';

/**
 * What the session chat's find bar steps through, counted on the words the
 * chat draws. The regressions this guards: a match in folded thinking
 * counted (the bar would land on nothing), a match split by a markdown mark
 * missed while it is on screen, a link's URL or a fence's language counted
 * when the chat shows neither, a match run from one block into the next,
 * case mattering, and a blank query finding every turn.
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
    reply('s2', '**Opened** [the PR](https://github.com/acme/app/pull/58). pr #58 is ready.'),
  ]),
  turn('t2', null, [reply('s3', 'Nothing to merge\n\n```ts\nconst done = true;\n```')]),
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

  it('reads a reply as it is drawn: marks gone, link targets and fence languages unseen', () => {
    expect(findInChat(turns, 'opened the pr')).toEqual([{ turnId: 't1', index: 0 }]);
    expect(findInChat(turns, 'github')).toEqual([]);
    expect(findInChat(turns, 'ts')).toEqual([]);
    expect(findInChat(turns, 'const done')).toEqual([{ turnId: 't2', index: 0 }]);
  });

  it('never runs a match from one block into the next, and skips thinking', () => {
    expect(findInChat(turns, 'merge const')).toEqual([]);
    expect(findInChat(turns, 'test')).toEqual([]);
  });

  it('finds nothing for a blank query', () => {
    expect(findInChat(turns, '   ')).toEqual([]);
  });
});
