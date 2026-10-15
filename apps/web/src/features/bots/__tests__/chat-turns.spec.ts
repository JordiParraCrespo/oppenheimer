import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  chatTurns,
  eventLine,
  replyParagraphs,
  toolTarget,
  turnDurationMs,
} from '../lib/chat-turns';

/** How the chat reads the stored conversation: as turns, each your message and the bot's work. */

const message = (id: string, turnId: string, role: BotMessageEntity['role']) =>
  ({ id, turnId, role }) as BotMessageEntity;
const turn = (id: string) => ({ id }) as BotTurnEntity;
const conversation = (messages: BotMessageEntity[], turns: BotTurnEntity[]) =>
  ({
    messages,
    turns,
    turn: (id: string) => turns.find((row) => row.id === id),
  }) as unknown as BotConversationEntity;

describe('chatTurns', () => {
  it('groups each turn’s messages under it, your message apart from the bot’s work', () => {
    const blocks = chatTurns(
      conversation(
        [
          message('m1', 't1', 'user'),
          message('m2', 't1', 'activity'),
          message('m3', 't1', 'assistant'),
          message('m4', 't2', 'user'),
        ],
        [turn('t1'), turn('t2')],
      ),
    );
    expect(
      blocks.map((block) => [
        block.turnId,
        block.asked.map((row) => row.id),
        block.answer.map((row) => row.id),
      ]),
    ).toEqual([
      ['t1', ['m1'], ['m2', 'm3']],
      ['t2', ['m4'], []],
    ]);
  });

  /** A turn older than the page has its messages and no row: drawn without a header, not dropped. */
  it('keeps messages whose turn the page does not hold', () => {
    const [block] = chatTurns(conversation([message('m1', 'old', 'assistant')], []));
    expect(block?.turn).toBeUndefined();
    expect(block?.answer).toHaveLength(1);
  });
});

describe('turnDurationMs', () => {
  it('is how long the turn ran, and nothing for one that never started', () => {
    const ran = {
      startedAt: new Date('2026-10-15T09:00:00Z'),
      endedAt: new Date('2026-10-15T09:00:12Z'),
    } as BotTurnEntity;
    expect(turnDurationMs(ran)).toBe(12_000);
    expect(turnDurationMs({ startedAt: null, endedAt: new Date() } as BotTurnEntity)).toBeNull();
  });
});

describe('replyParagraphs', () => {
  it('splits on blank lines and keeps a single line break inside a paragraph', () => {
    expect(replyParagraphs('One\ntwo\n\n\nThree\n')).toEqual(['One\ntwo', 'Three']);
  });
});

describe('toolTarget', () => {
  it('is the first text the call was given, on one line and cut short', () => {
    expect(toolTarget({ limit: 3, path: 'src/index.ts' })).toBe('src/index.ts');
    expect(toolTarget({ command: 'ls\npwd' })).toBe('ls');
    expect(toolTarget({ query: 'x'.repeat(100) })).toBe(`${'x'.repeat(80)}…`);
    expect(toolTarget({ limit: 3 })).toBeUndefined();
  });
});

describe('events from Oppenheimer', () => {
  it('opens its turn like your message does, apart from the bot’s answer', () => {
    const [block] = chatTurns(
      conversation([message('e1', 't1', 'event'), message('m2', 't1', 'assistant')], [turn('t1')]),
    );
    expect(block.asked.map((row) => row.id)).toEqual(['e1']);
    expect(block.answer.map((row) => row.id)).toEqual(['m2']);
  });

  it('reads a decision as its first line and how it went', () => {
    expect(eventLine('Ana approved: Start Claude Code\nIt ran: Started s-1.')).toEqual({
      headline: 'Ana approved: Start Claude Code',
      outcome: 'approved',
    });
    expect(eventLine('Ana approved: Start it\nIt ran and failed: Host offline.').outcome).toBe(
      'failed',
    );
    expect(eventLine('Ana denied: Start it\nTheir note: no').outcome).toBe('denied');
    expect(eventLine('Something else').outcome).toBeNull();
  });
});
