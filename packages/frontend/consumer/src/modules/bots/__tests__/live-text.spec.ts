import type { BotTurnStatus } from '@oppenheimer/shared/schemas/bot';
import { describe, expect, it } from 'vitest';
import { BotConversationEntity, BotMessageEntity, BotTurnEntity } from '../bot-conversation.entity';
import {
  appendBotText,
  type BotTextBuffers,
  botLiveText,
  forgetEndedBotTurns,
  liveSuffix,
  markBotStreamGap,
  NO_BOT_TEXT,
} from '../live-text';

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

/** Feeds deltas, with `|` standing for a reconnect between them. */
function streamed(turnId: string, ...pieces: string[]): BotTextBuffers {
  let buffers = NO_BOT_TEXT;
  for (const piece of pieces) {
    buffers = piece === '|' ? markBotStreamGap(buffers) : appendBotText(buffers, turnId, piece);
  }
  return buffers;
}

describe('the stream buffer', () => {
  it('appends each delta to its turn, and starts a segment at a reconnect', () => {
    expect(streamed('t1', 'Hel', 'lo', '|', ' there')).toEqual({ t1: ['Hello', ' there'] });
  });

  it('keeps a reconnect with nothing after it to one segment', () => {
    expect(streamed('t1', 'Hi', '|', '|')).toEqual({ t1: ['Hi', ''] });
  });

  it('drops only the turns the conversation shows ended', () => {
    const buffers = { ...streamed('t1', 'Done'), ...streamed('t2', 'Going') };
    const read = conversation([turn('t1', 'completed'), turn('t2', 'running')]);
    expect(forgetEndedBotTurns(buffers, read)).toEqual({ t2: ['Going'] });
    expect(forgetEndedBotTurns(buffers, undefined)).toBe(buffers);
  });
});

describe('liveSuffix', () => {
  it('draws all of it while nothing is stored', () => {
    expect(liveSuffix(['Hello'], [])).toBe('Hello');
  });

  it('strips each stored block, in order, and draws what follows', () => {
    expect(liveSuffix(['First.Second.Thi'], ['First.', 'Second.'])).toBe('Thi');
  });

  it('draws nothing when every streamed block is stored', () => {
    expect(liveSuffix(['First.Second.'], ['First.', 'Second.'])).toBe('');
  });

  /** Whitespace a block ends or starts with is not significant, nor an unstored blank block. */
  it('skips whitespace at block boundaries', () => {
    expect(liveSuffix(['\n\nFirst.\n\n  Second.\n Thi'], ['First.\n', '\nSecond.'])).toBe('Thi');
  });

  it('compares inside a block exactly', () => {
    expect(liveSuffix(['Hello  world. More'], ['Hello world.'])).toBe('');
  });

  /** The read landed before the block's last deltas: the stored message already shows them. */
  it('draws nothing while the stream is behind the stored text', () => {
    expect(liveSuffix(['First.Sec'], ['First.', 'Second.'])).toBe('');
  });

  /** Codex's finding: a partial reply with no stored message survives a reconnect. */
  it('keeps what streamed before a reconnect', () => {
    expect(liveSuffix(['Partial rep', ''], [])).toBe('Partial rep');
  });

  it('holds text after a reconnect until a stored message covers the hole', () => {
    expect(liveSuffix(['Hello', ' world. More'], [])).toBe('Hello');
    expect(liveSuffix(['Hello', ' world. More'], ['Hello big world.'])).toBe('More');
  });

  it('draws what follows the stored text that ended after a reconnect', () => {
    expect(liveSuffix(['First.', 'econd. Thi'], ['First.', 'Second.'])).toBe('Thi');
  });

  /** Mounted mid-turn: the stream holds the end of a block and what came after. */
  it('finds where the last stored block ends when the stream began inside it', () => {
    expect(liveSuffix(['nd block. Third'], ['First block.', 'Second block.'])).toBe('Third');
  });

  it('finds the last stored block when the stream began before it', () => {
    expect(liveSuffix(['ck. Second block. Third'], ['First block.', 'Second block.'])).toBe(
      'Third',
    );
  });

  it('draws nothing when the stream began after the last stored block', () => {
    expect(liveSuffix(['Third block'], ['First block.'])).toBe('');
  });

  /** The furthest end hides text rather than repeat stored text. */
  it('hides text rather than repeat stored text when the last block recurs', () => {
    expect(liveSuffix(['ah. Say ok. More. Say ok. Rest'], ['Blah.', 'Say ok.'])).toBe('Rest');
  });

  it('ignores blank stored text', () => {
    expect(liveSuffix(['Hello'], ['', '   '])).toBe('Hello');
  });
});

describe('botLiveText', () => {
  it('draws a running turn’s unstored text, by turn', () => {
    const read = conversation(
      [turn('t1', 'running')],
      [said('t1', 'Hi', 'activity'), said('t1', 'First.')],
    );
    expect(botLiveText(streamed('t1', 'First.', ' Sec'), read)).toEqual({ t1: 'Sec' });
  });

  it('draws nothing for a turn once the conversation shows it ended', () => {
    const read = conversation([turn('t1', 'completed')]);
    expect(botLiveText(streamed('t1', 'Unsaid'), read)).toEqual({});
  });

  it('draws a turn the conversation does not hold yet', () => {
    expect(botLiveText(streamed('t9', 'Early'), conversation([]))).toEqual({ t9: 'Early' });
  });

  it('leaves out a turn with nothing live', () => {
    const read = conversation([turn('t1', 'running')], [said('t1', 'All of it')]);
    expect(botLiveText(streamed('t1', 'All of it'), read)).toEqual({});
  });
});
