import { chatItemTurnSchema } from '@oppenheimer/shared/schemas/chat-item';
import { describe, expect, it } from 'vitest';
import { toTurns } from '../session-chat';
import { sessionChatItems } from '../session-chat-items';

/**
 * A Claude Code transcript in the one chat item model. The regressions this
 * guards: a call's item typed by its tool's name rather than what it does, a
 * call's result not carried onto its item, an item the shared schema
 * refuses, and a turn the agent is still in read as ended. The entries are
 * the runner's compacted lines, in Claude Code's own names.
 */

const user = (uuid: string, content: unknown, at = '2026-10-21T09:00:00.000Z') => ({
  type: 'user',
  uuid,
  timestamp: at,
  message: { role: 'user', content },
});

const assistant = (uuid: string, content: unknown[], at = '2026-10-21T09:00:30.000Z') => ({
  type: 'assistant',
  uuid,
  timestamp: at,
  message: { role: 'assistant', model: 'claude-opus-5-5', content },
});

const result = (uuid: string, id: string, content: string, at: string, isError = false) =>
  user(uuid, [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }], at);

const transcript = [
  user('u1', 'Fix the flaky test'),
  assistant('a1', [{ type: 'thinking', thinking: 'Look at the spec first.' }]),
  assistant('a2', [
    { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'src/clock.spec.ts' } },
    { type: 'tool_use', id: 't2', name: 'Grep', input: { pattern: 'setTimeout', path: 'src' } },
  ]),
  result('r1', 't1', 'it("ticks")', '2026-10-21T09:00:31.000Z'),
  result('r2', 't2', 'src/clock.ts:12', '2026-10-21T09:00:32.000Z'),
  assistant('a3', [
    {
      type: 'tool_use',
      id: 't3',
      name: 'Edit',
      input: { file_path: 'src/clock.ts', old_string: 'a', new_string: 'b\nc' },
    },
    { type: 'tool_use', id: 't4', name: 'Bash', input: { command: 'pnpm test' } },
    {
      type: 'tool_use',
      id: 't5',
      name: 'TodoWrite',
      input: { todos: [{ content: 'Fix the race', status: 'completed' }] },
    },
    { type: 'tool_use', id: 't6', name: 'mcp__github__get_issue', input: { number: 7 } },
    { type: 'tool_use', id: 't7', name: 'WebFetch', input: { url: 'https://vitest.dev' } },
  ]),
  result('r3', 't3', 'ok', '2026-10-21T09:00:40.000Z'),
  result('r4', 't4', '1 failed', '2026-10-21T09:00:50.000Z', true),
  assistant('a4', [{ type: 'text', text: 'Fixed.' }], '2026-10-21T09:01:00.000Z'),
  user('u2', 'Now ship it', '2026-10-21T09:02:00.000Z'),
  assistant('a5', [{ type: 'tool_use', id: 't8', name: 'Bash', input: { command: 'git push' } }]),
];

describe('sessionChatItems', () => {
  const turns = sessionChatItems(toTurns(transcript));

  it('reads each step as the item it is, each call by what it does, in order', () => {
    expect(turns[0]?.items.map((item) => item.type)).toEqual([
      'user_message',
      'reasoning',
      'file_read',
      'file_search',
      'file_change',
      'command',
      'todo_list',
      'mcp_tool_call',
      'web_search',
      'agent_message',
    ]);
  });

  it('carries each call’s target, result and what only its kind has', () => {
    const items = turns[0]?.items ?? [];
    expect(items.find((item) => item.id === 't2')).toMatchObject({
      pattern: 'setTimeout',
      status: 'completed',
      output: 'src/clock.ts:12',
    });
    expect(items.find((item) => item.id === 't3')).toMatchObject({
      path: 'src/clock.ts',
      kind: 'edit',
      additions: 2,
      deletions: 1,
      completedAt: '2026-10-21T09:00:40.000Z',
    });
    expect(items.find((item) => item.id === 't4')).toMatchObject({
      status: 'failed',
      command: 'pnpm test',
    });
    expect(items.find((item) => item.id === 't5')).toMatchObject({
      todos: [{ text: 'Fix the race', status: 'completed' }],
    });
    expect(items.find((item) => item.id === 't6')).toMatchObject({
      server: 'github',
      name: 'get_issue',
      label: 'github · get_issue',
    });
    expect(items.find((item) => item.id === 't7')).toMatchObject({ action: 'open', query: null });
  });

  it('ends a turn the agent answered, and keeps the one it is still in under way', () => {
    expect(turns.map((turn) => turn.status)).toEqual(['completed', 'in_progress']);
    expect(turns[1]?.items.at(-1)).toMatchObject({ type: 'command', status: 'in_progress' });
    expect(turns[1]?.completedAt).toBeNull();
  });

  it('is what the shared schema accepts', () => {
    for (const turn of turns) expect(chatItemTurnSchema.safeParse(turn).success).toBe(true);
  });
});
