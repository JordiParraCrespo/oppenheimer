import { SessionChat } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { blocksOf, elapsedOf, latestTodos, modelName, summaryOf } from '../lib/chat-blocks';

/**
 * How the chat view lays out a turn: a run of calls folds into one group
 * with a verb summary, only the turn's last task list is kept (for the
 * composer), a plan is its own card, and the header's clock and model read
 * the way people say them.
 */

const tool = (id: string, name: string, input: Record<string, unknown> = {}) => ({
  type: 'tool_use',
  id,
  name,
  input,
});

function turnOf(content: unknown[]) {
  const chat = new SessionChat();
  chat.apply({
    reset: true,
    entries: [
      JSON.stringify({
        type: 'user',
        uuid: 'u',
        timestamp: '2026-10-21T09:00:00.000Z',
        message: { role: 'user', content: 'Go' },
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'a',
        timestamp: '2026-10-21T09:01:13.000Z',
        message: { role: 'assistant', model: 'claude-sonnet-5-5', content },
      }),
    ],
  });
  const turn = chat.snapshot().turns[0];
  if (!turn) throw new Error('no turn');
  return turn;
}

const t = ((key: string, options?: { count?: number }) =>
  `${key.split('.').at(-1)}×${options?.count}`) as unknown as TFunction;

describe('blocksOf', () => {
  it('folds a run of calls into one group, and keeps a reply, a plan and the last task list apart', () => {
    const turn = turnOf([
      tool('1', 'Read', { file_path: 'a.ts' }),
      tool('2', 'Grep', { pattern: 'x' }),
      tool('t1', 'TodoWrite', { todos: [{ content: 'One', status: 'pending' }] }),
      tool('3', 'Bash', { command: 'ls' }),
      { type: 'text', text: 'Done.' },
      tool('p', 'ExitPlanMode', { plan: '1. Ship' }),
      tool('t2', 'TodoWrite', { todos: [{ content: 'One', status: 'completed' }] }),
    ]);
    const blocks = blocksOf(turn);
    expect(blocks.map((block) => block.kind)).toEqual(['tools', 'reply', 'plan', 'todos']);
    expect(blocks[0]?.kind === 'tools' && blocks[0].calls.map((call) => call.name)).toEqual([
      'Read',
      'Grep',
      'Bash',
    ]);
    expect(latestTodos(turn)).toEqual([{ content: 'One', status: 'completed' }]);
  });
});

describe('summaryOf', () => {
  it('counts the calls by verb, looked-at before changed', () => {
    const turn = turnOf([
      tool('1', 'Bash', { command: 'ls' }),
      tool('2', 'Edit', { file_path: 'a' }),
      tool('3', 'Read', { file_path: 'a' }),
      tool('4', 'Read', { file_path: 'b' }),
    ]);
    const group = blocksOf(turn)[0];
    expect(group?.kind === 'tools' && summaryOf(group.calls, t)).toBe('Read×2, edit×1, command×1');
  });
});

describe('the turn header', () => {
  it('says how long the turn ran and on which model, as people say them', () => {
    expect(elapsedOf(turnOf([{ type: 'text', text: 'ok' }]))).toBe('1m 13s');
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5');
    expect(modelName('claude-haiku-5')).toBe('Haiku 5');
    expect(modelName('gpt-5.6')).toBe('gpt-5.6');
    expect(modelName(null)).toBeNull();
  });
});
