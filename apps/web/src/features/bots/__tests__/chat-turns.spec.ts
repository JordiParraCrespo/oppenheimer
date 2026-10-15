import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  type ChatTurnBlock,
  chatTurns,
  compactTokens,
  markersBefore,
  replyText,
  retryContent,
  turnDurationMs,
  turnPhase,
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

describe('turnPhase', () => {
  const at = (status: BotTurnEntity['status']) => ({ status }) as BotTurnEntity;

  /** Thinking until the first word or call shows, then working; an ended turn says how it ended. */
  it('tells thinking from working by whether anything is on screen yet', () => {
    expect(turnPhase(at('queued'), false)).toBe('queued');
    expect(turnPhase(at('running'), false)).toBe('thinking');
    expect(turnPhase(at('running'), true)).toBe('working');
    expect(turnPhase(at('cancelled'), true)).toBe('cancelled');
    expect(turnPhase(at('failed'), false)).toBe('failed');
  });
});

const said = (id: string, role: BotMessageEntity['role'], content: string) =>
  ({ id, turnId: 't', role, content }) as BotMessageEntity;
const block = (
  status: BotTurnEntity['status'] | undefined,
  asked: BotMessageEntity[],
  answer: BotMessageEntity[] = [],
): ChatTurnBlock => ({
  turnId: 't',
  turn: status
    ? ({ id: 't', status, isActive: status === 'queued' || status === 'running' } as BotTurnEntity)
    : undefined,
  asked,
  answer,
});

describe('replyText', () => {
  it('copies what the bot said, a blank line apart, and none of its tool work', () => {
    const turnBlock = block(
      'completed',
      [],
      [
        said('a', 'assistant', ' First. '),
        said('b', 'activity', ''),
        said('c', 'assistant', 'Second.'),
      ],
    );
    expect(replyText(turnBlock)).toBe('First.\n\nSecond.');
  });
});

describe('retryContent', () => {
  /** Retry resends the question of the newest turn once it has ended, and only that one. */
  it('is your last message in the newest ended turn, and nothing while it runs', () => {
    const asked = [said('q1', 'user', 'first try'), said('q2', 'user', 'what about bun?')];
    expect(retryContent([block('failed', asked)])).toBe('what about bun?');
    expect(
      retryContent([block('completed', [said('q0', 'user', 'old')]), block('cancelled', asked)]),
    ).toBe('what about bun?');
    expect(retryContent([block('failed', asked), block('running', asked)])).toBeNull();
    expect(retryContent([block(undefined, asked)])).toBeNull();
    expect(retryContent([])).toBeNull();
  });
});

describe('compactTokens', () => {
  it('prints thousands with one decimal under ten thousand, whole above', () => {
    expect(compactTokens(840)).toBe('840');
    expect(compactTokens(3100)).toBe('3.1k');
    expect(compactTokens(2000)).toBe('2k');
    expect(compactTokens(12_400)).toBe('12k');
  });
});

describe('markersBefore', () => {
  const at = (iso: string, model: string): ChatTurnBlock => ({
    turnId: iso,
    turn: { id: iso, provider: 'glm', model, createdAt: new Date(iso) } as BotTurnEntity,
    asked: [{ createdAt: new Date(iso) } as BotMessageEntity],
    answer: [],
  });

  /** A day line where the day changes, a model note where the model does; nothing before the first turn. */
  it('marks a new day and a switched model, and nothing else', () => {
    const blocks = [
      at('2026-10-14T09:00:00', 'glm-5.3'),
      at('2026-10-14T18:00:00', 'glm-5.3'),
      at('2026-10-15T09:00:00', 'glm-5.3'),
      at('2026-10-15T10:00:00', 'glm-4.6'),
    ];
    expect(markersBefore(blocks, 0)).toEqual({ day: null, model: null });
    expect(markersBefore(blocks, 1)).toEqual({ day: null, model: null });
    expect(markersBefore(blocks, 2).day?.getDate()).toBe(15);
    expect(markersBefore(blocks, 2).model).toBeNull();
    expect(markersBefore(blocks, 3)).toEqual({ day: null, model: blocks[3]?.turn });
  });
});
