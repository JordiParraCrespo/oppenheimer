import { chatItemTurnSchema } from '@oppenheimer/shared/schemas/chat-item';
import { describe, expect, it } from 'vitest';
import { botChatItems } from '../bot-chat-items';
import {
  BotConversationEntity,
  BotMessageEntity,
  type BotToolStep,
  BotTurnEntity,
} from '../bot-conversation.entity';

/**
 * A bot's chat in the one chat item model. The regressions this guards: a
 * bot's web search or to-do list typed apart from the same tool in a
 * session, its own tools shown by their MCP name, a call left running in a
 * turn that ended, and a routine's line outside any turn dropped.
 */

const at = (seconds: number) => new Date(Date.UTC(2026, 9, 21, 9, 0, seconds));

const step = (
  callId: string,
  name: string,
  input: Record<string, unknown>,
  output: string | null,
) =>
  ({
    callId,
    name,
    input,
    output,
    isError: false,
    sessionId: null,
    subagents: null,
    allowedBy: null,
    mailDraft: null,
  }) satisfies BotToolStep;

const turn = (id: string, status: 'completed' | 'running' | 'cancelled', start: number) =>
  new BotTurnEntity(
    id,
    status,
    'anthropic',
    'claude-opus-5-5',
    null,
    0,
    0,
    false,
    at(start),
    at(start),
    status === 'running' ? null : at(start + 20),
  );

const conversation = new BotConversationEntity(
  [
    new BotMessageEntity('m1', 'turn-1', 'user', 'Compare bun and node', [], at(0)),
    new BotMessageEntity(
      'm2',
      'turn-1',
      'activity',
      '',
      [
        step('c1', 'WebSearch', { query: 'bun vs node' }, '[]'),
        step('c2', 'TodoWrite', { todos: [{ content: 'Read both', status: 'in_progress' }] }, ''),
        step('c3', 'mcp__oppenheimer__read_document', { name: 'notes.md' }, 'notes'),
        step('c4', 'mcp__oppenheimer__delegate', { tasks: [{ task: 'a' }, { task: 'b' }] }, null),
      ],
      at(2),
    ),
    new BotMessageEntity('m3', 'turn-1', 'assistant', 'Bun starts faster.', [], at(10)),
    new BotMessageEntity('m4', null, 'event', 'Paused the daily digest', [], at(30)),
    new BotMessageEntity('m5', 'turn-2', 'user', 'And deno?', [], at(40)),
    new BotMessageEntity(
      'm6',
      'turn-2',
      'activity',
      '',
      [step('c5', 'web_search', { query: 'deno' }, null)],
      at(41),
    ),
  ],
  [turn('turn-1', 'cancelled', 0), turn('turn-2', 'running', 40)],
  4,
);

describe('botChatItems', () => {
  const turns = botChatItems(conversation);

  it('keeps each turn’s lines under it, and a line outside any turn as one of its own', () => {
    expect(turns.map((t) => [t.id, t.status])).toEqual([
      ['turn-1', 'interrupted'],
      ['m4', 'completed'],
      ['turn-2', 'in_progress'],
    ]);
    expect(turns[1]?.items).toMatchObject([{ type: 'event', text: 'Paused the daily digest' }]);
  });

  it('types each call the way the session chat types the same tool', () => {
    expect(turns[0]?.items.map((item) => item.type)).toEqual([
      'user_message',
      'web_search',
      'todo_list',
      'tool_call',
      'subagent',
      'agent_message',
    ]);
    const [, search, todos, own, delegate] = turns[0]?.items ?? [];
    expect(search).toMatchObject({ action: 'search', query: 'bun vs node' });
    expect(todos).toMatchObject({ todos: [{ text: 'Read both', status: 'in_progress' }] });
    expect(own).toMatchObject({ label: 'Read document', target: 'notes.md', status: 'completed' });
    expect(delegate).toMatchObject({ tasks: 2 });
  });

  it('reads a call with no output as running while its turn runs, and as failed once it ended', () => {
    expect(turns[0]?.items.find((item) => item.id === 'c4')?.status).toBe('failed');
    expect(turns[2]?.items.find((item) => item.id === 'c5')?.status).toBe('in_progress');
  });

  it('is what the shared schema accepts', () => {
    for (const t of turns) expect(chatItemTurnSchema.safeParse(t).success).toBe(true);
  });
});
