import { describe, expect, it } from 'vitest';
import {
  telegramMessageIdOf,
  telegramReplyOf,
  telegramSourceKey,
  telegramTurn,
} from '../domain/bot-telegram-turn.policy';

/**
 * A message of the owner's on Telegram is a turn of its own conversation,
 * once however often it is delivered, and its answer always goes back.
 */

const CONVERSATION = '0b3e2a1c-5555-4c5d-8e6f-70819203b4c5';
const ACCOUNT = '0b3e2a1c-6666-4c5d-8e6f-70819203b4c5';
const props = {
  organizationId: 'org',
  botId: 'bot',
  requestedByUserId: 'user',
  provider: 'anthropic' as const,
  model: 'claude',
  effort: null,
};

describe('telegramTurn', () => {
  // What breaks this: a Telegram message landing in the console chat, or
  // twice as two turns (a delivery again after /new opened another conversation).
  it('queues the message in the chat’s conversation, keyed by the message alone', () => {
    const message = {
      conversationId: CONVERSATION,
      telegramAccountId: ACCOUNT,
      chatId: '123456789',
      messageId: '42',
      text: 'Is the build green?',
    };
    const { turn, opening } = telegramTurn(props, message);
    expect(turn.conversationId).toBe(CONVERSATION);
    expect(turn.inConsole).toBe(false);
    expect(turn.origin).toBe('telegram');
    expect(turn.lane).toBe('owner');
    expect(turn.sourceKey).toBe(telegramSourceKey(message));
    expect(turn.sourceKey).not.toContain(CONVERSATION);
    expect(opening.conversationId).toBe(CONVERSATION);
    expect(opening.role).toBe('user');
    expect(opening.content).toBe('Is the build green?');
    expect(telegramMessageIdOf(turn.sourceKey)).toBe('42');
  });

  it('reads no message id from a key that is not a Telegram turn’s', () => {
    expect(telegramMessageIdOf(null)).toBeNull();
    expect(telegramMessageIdOf('automation-run:a:b')).toBeNull();
  });
});

describe('telegramReplyOf', () => {
  // What breaks this: the person on their phone left without an answer.
  it('sends the last words, and says what happened when there are none', () => {
    expect(telegramReplyOf({ status: 'completed', error: null }, ['first', 'last', ' '])).toBe(
      'last',
    );
    expect(telegramReplyOf({ status: 'failed', error: 'No key.' }, ['partial'])).toBe(
      'I could not finish that: No key.',
    );
    expect(telegramReplyOf({ status: 'cancelled', error: null }, [])).toBe('Stopped.');
    expect(telegramReplyOf({ status: 'completed', error: null }, [])).toMatch(/console/);
  });
});
