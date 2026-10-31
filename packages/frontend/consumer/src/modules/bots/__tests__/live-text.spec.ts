import type { BotTurnStatus } from '@oppenheimer/shared/schemas/bot';
import { describe, expect, it } from 'vitest';
import { BotConversationEntity, BotMessageEntity, BotTurnEntity } from '../bot-conversation.entity';
import {
  appendBotText,
  type BotTextBuffers,
  botLiveText,
  forgetEndedBotTurns,
  NO_BOT_TEXT,
  putBotSnapshot,
} from '../live-text';

/**
 * A turn's live text as the stream says it and the conversation stores it:
 * deltas placed by block and dropped by `seq` when already held, a snapshot
 * in place of the block it covers, and each block drawn until the read that
 * stores it lands. The frames' order and the API's side are the stream's
 * specs (`stream-bot.query-handler.spec.ts`, `bot-stream.integration.spec.ts`).
 */
const at = new Date('2026-10-01T10:00:00Z');

function turn(id: string, status: BotTurnStatus): BotTurnEntity {
  return new BotTurnEntity(id, status, 'anthropic', 'm', null, 0, 0, false, at, null, null);
}

function said(turnId: string, content: string, role: 'assistant' | 'activity' = 'assistant') {
  return new BotMessageEntity(`${turnId}-${content}`, turnId, role, content, [], at);
}

function conversation(
  turns: BotTurnEntity[],
  messages: BotMessageEntity[] = [],
): BotConversationEntity {
  return new BotConversationEntity(messages, turns, messages.length);
}

/** Deltas of turn `t1`, each `[block, text]`, numbered from `seq` 1. */
function streamed(...pieces: [number, string][]): BotTextBuffers {
  return pieces.reduce(
    (buffers, [block, text], index) =>
      appendBotText(buffers, { type: 'text', turnId: 't1', block, seq: index + 1, text }),
    NO_BOT_TEXT,
  );
}

describe('the stream buffer', () => {
  it('adds each delta to its block', () => {
    expect(streamed([0, 'Hel'], [0, 'lo'], [1, 'Next'])).toEqual({
      t1: { seq: 3, blocks: { 0: 'Hello', 1: 'Next' } },
    });
  });

  // What breaks this: a delta heard both in the snapshot and on the channel
  // after it drawn twice ("Hello, worldworld").
  it('drops a delta at or below the seq it holds', () => {
    let buffers = putBotSnapshot(NO_BOT_TEXT, {
      type: 'snapshot',
      turnId: 't1',
      block: 0,
      seq: 3,
      text: 'Hello, world',
    });
    for (const [seq, text] of [
      [2, 'lo, '],
      [3, 'world'],
      [4, '!'],
      [4, '!'],
    ] as const) {
      buffers = appendBotText(buffers, { type: 'text', turnId: 't1', block: 0, seq, text });
    }
    expect(buffers.t1).toEqual({ seq: 4, blocks: { 0: 'Hello, world!' } });
  });

  // What breaks this: a reconnect keeping the half block it had and adding
  // the snapshot to it, or keeping the hole the drop left.
  it('puts a snapshot in place of the block it covers and any later one, keeping earlier ones', () => {
    const buffers = putBotSnapshot(streamed([0, 'First.'], [1, 'Sec'], [2, 'stale']), {
      type: 'snapshot',
      turnId: 't1',
      block: 1,
      seq: 9,
      text: 'Second, whole',
    });
    expect(buffers.t1).toEqual({ seq: 9, blocks: { 0: 'First.', 1: 'Second, whole' } });
  });

  it('drops only the turns the conversation shows ended', () => {
    const buffers = {
      ...streamed([0, 'Done']),
      t2: { seq: 1, blocks: { 0: 'Going' } },
    };
    const read = conversation([turn('t1', 'completed'), turn('t2', 'running')]);
    expect(forgetEndedBotTurns(buffers, read)).toEqual({ t2: { seq: 1, blocks: { 0: 'Going' } } });
    expect(forgetEndedBotTurns(buffers, undefined)).toBe(buffers);
  });
});

describe('botLiveText', () => {
  it('draws the blocks the conversation does not hold yet, by turn', () => {
    const read = conversation(
      [turn('t1', 'running')],
      [said('t1', 'Hi', 'activity'), said('t1', 'First.')],
    );
    expect(botLiveText(streamed([0, 'First.'], [1, ' Sec']), read)).toEqual({ t1: 'Sec' });
  });

  /**
   * The regression this guards: text stored as a message drawn twice, once
   * from the conversation and once still live; or dropped before the read
   * that holds it landed, so it blinked out.
   */
  it('keeps a block live until the read that stores it lands', () => {
    const buffers = streamed([0, 'First.'], [1, 'Second']);
    expect(botLiveText(buffers, conversation([turn('t1', 'running')]))).toEqual({
      t1: 'First.\n\nSecond',
    });
    const read = conversation([turn('t1', 'running')], [said('t1', 'First (as stored).')]);
    expect(botLiveText(buffers, read)).toEqual({ t1: 'Second' });
  });

  it('counts neither an image message nor an activity line as a stored block', () => {
    const read = conversation(
      [turn('t1', 'running')],
      [said('t1', '', 'assistant'), said('t1', 'Ran it', 'activity')],
    );
    expect(botLiveText(streamed([0, 'Still writing']), read)).toEqual({ t1: 'Still writing' });
  });

  it('draws nothing for a turn once the conversation shows it ended', () => {
    const read = conversation([turn('t1', 'completed')]);
    expect(botLiveText(streamed([0, 'Unsaid']), read)).toEqual({});
  });

  it('draws a turn the conversation does not hold yet', () => {
    expect(botLiveText(streamed([0, 'Early']), conversation([]))).toEqual({ t1: 'Early' });
  });

  it('leaves out a turn with nothing live', () => {
    const read = conversation([turn('t1', 'running')], [said('t1', 'All of it')]);
    expect(botLiveText(streamed([0, 'All of it'], [1, '  ']), read)).toEqual({});
  });
});
