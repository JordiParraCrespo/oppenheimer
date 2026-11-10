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
  drawsNothing,
  markersBefore,
  replyText,
  retryContent,
  turnDurationMs,
  turnPhase,
} from '../lib/chat-turns';

/** How the chat reads the stored conversation: as turns, each your message and the bot's work. */

const message = (id: string, turnId: string | null, role: BotMessageEntity['role']) =>
  ({ id, turnId, role }) as BotMessageEntity;
const turn = (id: string) => ({ id }) as BotTurnEntity;
const conversation = (
  messages: BotMessageEntity[],
  turns: BotTurnEntity[],
  waiting: string[] = [],
) =>
  ({
    messages,
    turns,
    waitingMessages: waiting.map((turnId) => ({ turnId, text: '', images: 0 })),
    turn: (id: string) => turns.find((row) => row.id === id),
  }) as unknown as BotConversationEntity;

describe('chatTurns', () => {
  // What breaks this: a turn that compacted drawing a line for it, above the
  // bot's work as if it opened the turn, and Retry resending its note as yours.
  it('leaves a compaction out of the chat, and Retry on your message', () => {
    const folded = {
      id: 'm3',
      turnId: 't1',
      role: 'event',
      content: 'Earlier in this turn, what you had read was summarized.',
      attachments: [],
      event: { kind: 'compaction', tokensBefore: 91_000, tokensAfter: 18_000 },
    } as unknown as BotMessageEntity;
    const asked = { ...message('m1', 't1', 'user'), content: 'Tag the invoices', attachments: [] };
    const ended = { id: 't1', status: 'completed', isActive: false } as BotTurnEntity;
    const blocks = chatTurns(
      conversation(
        [
          asked as BotMessageEntity,
          message('m2', 't1', 'activity'),
          folded,
          message('m4', 't1', 'activity'),
        ],
        [ended],
      ),
    );
    expect(
      blocks.map((block) => [block.asked.map((row) => row.id), block.answer.map((row) => row.id)]),
    ).toEqual([[['m1'], ['m2', 'm4']]]);
    expect(retryContent(blocks)).toBe('Tag the invoices');
  });

  // What breaks this: a routine's run opening its turn with a line that names
  // the routine, so the bot's message reads as an automation's output; or a
  // run that did not happen, which the owner must hear of, dropped with it.
  it('leaves a routine’s run and its changes out of the chat, and keeps what needs the owner', () => {
    const routine = (id: string, turnId: string | null, activity: string, reason: string | null) =>
      ({
        ...message(id, turnId, 'event'),
        event: { kind: 'routine', activity, automationId: 'a-1', runId: null, name: 'PRs', reason },
      }) as unknown as BotMessageEntity;
    const blocks = chatTurns(
      conversation(
        [
          routine('r1', 't1', 'ran', null),
          message('m1', 't1', 'assistant'),
          routine('r2', null, 'saved', null),
          routine('r3', null, 'paused', 'user'),
          routine('r4', null, 'paused', 'bot_provider_missing'),
          routine('r5', null, 'failed', 'missed'),
        ],
        [turn('t1')],
      ),
    );
    expect(
      blocks.map((block) => [block.asked.map((row) => row.id), block.answer.map((row) => row.id)]),
    ).toEqual([
      [[], ['m1']],
      [['r4'], []],
      [['r5'], []],
    ]);
  });

  // What breaks this: a routine's turn that failed before the bot wrote, or a
  // heartbeat that found nothing, losing its place with its line: the first
  // drawn under everything said since, the second as an empty gap every hour.
  it('keeps a routine’s turn where it ran, and leaves out one that only ran tools', () => {
    const ran = {
      ...message('r1', 't1', 'event'),
      event: { kind: 'routine', activity: 'ran', automationId: 'a-1', runId: 'r', name: 'PRs' },
    } as unknown as BotMessageEntity;
    const failed = { id: 't1', status: 'failed' } as BotTurnEntity;
    const quiet = { id: 't3', status: 'completed' } as BotTurnEntity;
    const blocks = chatTurns(
      conversation(
        [
          ran,
          message('m1', 't2', 'user'),
          message('m2', 't2', 'assistant'),
          { ...ran, id: 'r2', turnId: 't3' } as BotMessageEntity,
          message('m3', 't3', 'activity'),
        ],
        [failed, turn('t2'), quiet],
      ),
    );
    expect(blocks.map((block) => block.turnId)).toEqual(['t1', 't2', 't3']);
    expect(blocks.map((block) => drawsNothing(block, false))).toEqual([false, false, true]);
    expect(blocks.map((block) => drawsNothing(block, true))).toEqual([false, false, false]);
  });

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

  // What breaks this: a message steered into a turn drawn as the turn's
  // opening, above work the bot did before it took it.
  it('keeps a message you steered in inside the answer, where the bot took it', () => {
    const blocks = chatTurns(
      conversation(
        [
          message('m1', 't1', 'user'),
          message('m2', 't1', 'activity'),
          message('s1', 't1', 'user'),
          message('m3', 't1', 'activity'),
        ],
        [turn('t1')],
      ),
    );
    expect(
      blocks.map((block) => [block.asked.map((row) => row.id), block.answer.map((row) => row.id)]),
    ).toEqual([[['m1'], ['m2', 's1', 'm3']]]);
  });

  // What breaks this: a message sent while the bot works drawn twice, in the
  // transcript as a queued turn and on the composer as waiting.
  it('leaves out a message waiting behind the turn under way, which the composer shows', () => {
    const blocks = chatTurns(
      conversation(
        [message('m1', 't1', 'user'), message('m2', 't1', 'activity'), message('m3', 't2', 'user')],
        [turn('t1'), turn('t2')],
        ['t2'],
      ),
    );
    expect(blocks.map((block) => block.turnId)).toEqual(['t1']);
  });

  // What breaks this: a routine's line outside any turn folded into the turn
  // beside it, or dropped, or two such lines merged into one.
  it('draws each line outside any turn as a block of its own, where it happened', () => {
    const blocks = chatTurns(
      conversation(
        [
          message('m1', 't1', 'user'),
          message('r1', null, 'event'),
          message('r2', null, 'event'),
          message('m2', 't1', 'assistant'),
        ],
        [turn('t1')],
      ),
    );
    expect(
      blocks.map((block) => [block.key, block.turnId, block.asked.map((row) => row.id)]),
    ).toEqual([
      ['t1', 't1', ['m1']],
      ['r1', null, ['r1']],
      ['r2', null, ['r2']],
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

const said = (
  id: string,
  role: BotMessageEntity['role'],
  content: string,
  attachments: BotMessageEntity['attachments'] = [],
) => ({ id, turnId: 't', role, content, attachments }) as BotMessageEntity;
const block = (
  status: BotTurnEntity['status'] | undefined,
  asked: BotMessageEntity[],
  answer: BotMessageEntity[] = [],
): ChatTurnBlock => ({
  key: 't',
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
    // A routine's line after the turn does not take Retry away.
    const line: ChatTurnBlock = { key: 'r1', turnId: null, turn: undefined, asked: [], answer: [] };
    expect(retryContent([block('failed', asked), line])).toBe('what about bun?');
  });

  it('offers no Retry for a message that carried images: an image is sent once', () => {
    const image = { id: 'a1', mimeType: 'image/png' as const, sizeBytes: 10, name: 'shot.png' };
    expect(retryContent([block('failed', [said('q1', 'user', 'what is this?', [image])])])).toBe(
      null,
    );
    expect(retryContent([block('failed', [said('q1', 'user', '', [image])])])).toBeNull();
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
    key: iso,
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

describe('events from Oppenheimer', () => {
  it('opens its turn like your message does, apart from the bot’s answer', () => {
    const [block] = chatTurns(
      conversation([message('e1', 't1', 'event'), message('m2', 't1', 'assistant')], [turn('t1')]),
    );
    expect(block.asked.map((row) => row.id)).toEqual(['e1']);
    expect(block.answer.map((row) => row.id)).toEqual(['m2']);
  });
});
