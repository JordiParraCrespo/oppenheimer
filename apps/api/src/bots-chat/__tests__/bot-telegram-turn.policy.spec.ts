import { describe, expect, it } from 'vitest';
import {
  telegramMessageIdOf,
  telegramSourceKey,
  telegramTurn,
} from '../domain/bot-telegram-turn.policy';
import { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * A message of the owner's on Telegram is a turn of its own conversation,
 * once however often it is delivered, and an ask made from it goes on there.
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

describe('an ask made on Telegram', () => {
  // What breaks this: the answer of an ask_bot from a Telegram turn picked up
  // in the console, so the person on their phone never gets the result.
  it('is answered in the Telegram conversation, as a turn whose words go back there', () => {
    const { turn: asking } = telegramTurn(props, {
      conversationId: CONVERSATION,
      telegramAccountId: ACCOUNT,
      chatId: '123456789',
      messageId: '42',
      text: 'Ask Shop what sold today',
    });
    const asked = BotTurnEntity.queueFromBot(asking, {
      botId: 'shop',
      provider: 'anthropic',
      model: 'claude',
      effort: null,
      replyRequested: true,
    });
    asked.end('completed', new Date());

    const answer = BotTurnEntity.queueAnswer(
      asked,
      { botId: 'bot', provider: 'anthropic', model: 'claude', effort: null },
      asking,
    );

    expect(answer.conversationId).toBe(CONVERSATION);
    expect(answer.origin).toBe('telegram');
  });
});
