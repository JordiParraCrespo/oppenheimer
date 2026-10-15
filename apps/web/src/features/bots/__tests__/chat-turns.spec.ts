import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  type ChatTurnBlock,
  chatTurns,
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
  turn: status ? ({ id: 't', status } as BotTurnEntity) : undefined,
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
  /** Retry resends the question of the newest failed turn, and only that one. */
  it('is your last message when the newest turn failed, and nothing otherwise', () => {
    const asked = [said('q1', 'user', 'first try'), said('q2', 'user', 'what about bun?')];
    expect(retryContent([block('failed', asked)])).toBe('what about bun?');
    expect(retryContent([block('failed', asked), block('completed', asked)])).toBeNull();
    expect(retryContent([block('cancelled', asked)])).toBeNull();
    expect(retryContent([])).toBeNull();
  });
});
