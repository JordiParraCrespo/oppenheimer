import { describe, expect, it } from 'vitest';
import { channelConversationFor, channelReplyOf } from '../domain/bot-channel-turn.policy';

/**
 * A channel's chat (Telegram, WhatsApp) is a run of conversations, each from
 * a start to the next, and every turn asked there sends an answer back.
 */

describe('channelReplyOf', () => {
  // What breaks this: the person on their phone left without an answer.
  it('sends the last words, and says what happened when there are none', () => {
    expect(channelReplyOf({ status: 'completed', error: null }, ['first', 'last', ' '])).toBe(
      'last',
    );
    expect(channelReplyOf({ status: 'failed', error: 'No key.' }, ['partial'])).toBe(
      'I could not finish that: No key.',
    );
    expect(channelReplyOf({ status: 'cancelled', error: null }, [])).toBe('Stopped.');
    expect(channelReplyOf({ status: 'completed', error: null }, [])).toMatch(/console/);
  });
});

describe('channelConversationFor', () => {
  const start = (botId: string, startsAt: string) => ({
    id: `${botId}@${startsAt}`,
    botId,
    startsAt,
  });

  // What breaks this: a message after /new read with the old history, or a
  // bot bound back resuming where it left off.
  it('keeps the bot’s current conversation, starts at a later /new, and afresh after another bot', () => {
    expect(channelConversationFor(start('a', '0'), '0', '9', 'a')).toEqual({ use: 'a@0' });
    expect(channelConversationFor(start('a', '0'), '8', '9', 'a')).toEqual({ start: '8' });
    expect(channelConversationFor(null, '0', '1', 'a')).toEqual({ start: '0' });
    expect(channelConversationFor(start('b', '20'), '0', '40', 'a')).toEqual({ start: '40' });
    expect(channelConversationFor(start('a', '40'), '0', '41', 'a')).toEqual({ use: 'a@40' });
  });

  // What breaks this: WhatsApp's seq compared as text, so a switch at seq 9
  // reads as later than a conversation that started at seq 10 and the chat
  // keeps the old bot's history; or a seq past 2^53 rounded onto another.
  it('orders WhatsApp starts by seq as numbers, whatever their length', () => {
    expect(channelConversationFor(start('shop', '10'), '9', '12', 'shop')).toEqual({
      use: 'shop@10',
    });
    expect(channelConversationFor(start('shop', '9'), '10', '12', 'shop')).toEqual({
      start: '10',
    });
    expect(
      channelConversationFor(
        start('shop', '9007199254740993'),
        '9007199254740992',
        '9007199254740994',
        'shop',
      ),
    ).toEqual({ use: 'shop@9007199254740993' });
  });
});
