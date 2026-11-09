import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { None, Some } from 'oxide.ts';
import { ReplyOnTelegramCommand } from '../../../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import type {
  BotConversationRepositoryPort,
  BotTelegramChat,
} from '../../../database/bot-conversation.repository.port';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { telegramReplyOf, telegramTurn } from '../../../domain/bot-telegram-turn.policy';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { DeliverTelegramReplyCommand } from '../deliver-telegram-reply.command';
import { DeliverTelegramReplyCommandHandler } from '../deliver-telegram-reply.command-handler';

/**
 * A Telegram turn's answer going back: once the turn ended, its last words go
 * to the chat its conversation is, as a reply to the message that opened it.
 * A console turn, a turn still running, a turn since gone and a chat whose
 * Telegram bot was disconnected send nothing. Whether the bot still answers
 * there is the telegram module's (`ReplyOnTelegramCommandHandler`).
 */
const organizationId = randomUUID();
const userId = randomUUID();
const botId = randomUUID();
const telegramAccountId = randomUUID();
const conversationId = randomUUID();
const engine = { provider: 'glm' as const, model: 'glm-5.3', effort: null };

function telegram(): BotTurnEntity {
  const { turn } = telegramTurn(
    { organizationId, botId, requestedByUserId: userId, ...engine },
    {
      conversationId,
      telegramAccountId,
      chatId: '123456789',
      messageId: '42',
      text: 'Is CI green?',
    },
  );
  return turn;
}

function consoleTurn(): BotTurnEntity {
  return BotTurnEntity.queue({ organizationId, botId, requestedByUserId: userId, ...engine });
}

function ended(turn: BotTurnEntity, status: 'completed' | 'failed' = 'completed'): BotTurnEntity {
  turn.start(new Date());
  turn.end(status, new Date(), status === 'failed' ? { error: 'The key was refused.' } : {});
  return turn;
}

function setup(turn: BotTurnEntity | null, chat: BotTelegramChat | null = null) {
  const texts = ['Looking it up.', 'Green since 10:12.'];
  const turns = {
    findForRun: vi.fn(async (id: string) => (turn && id === turn.id ? Some(turn) : None)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    findTurnTexts: vi.fn(async () => texts),
  } satisfies Partial<BotMessageRepositoryPort>;
  const conversations = {
    // Any conversation is the chat here, so only the turn's origin keeps a
    // console turn off Telegram.
    findTelegram: vi.fn(async () => chat),
  } satisfies Partial<BotConversationRepositoryPort>;
  const bus = { execute: vi.fn(async () => 1) };
  const handler = new DeliverTelegramReplyCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    conversations as unknown as BotConversationRepositoryPort,
    bus as unknown as CommandBus,
  );
  const deliver = () =>
    handler.execute(new DeliverTelegramReplyCommand({ turnId: turn?.id ?? randomUUID() }));
  return { bus, texts, deliver };
}

const chat: BotTelegramChat = { organizationId, botId, telegramAccountId, chatId: '123456789' };

describe('DeliverTelegramReplyCommandHandler', () => {
  // Breaks if the reply is not threaded under the message it answers, or goes
  // to another chat or Telegram bot than the conversation's.
  it('replies in the conversation’s Telegram chat, under the message that opened the turn, with its last words', async () => {
    const turn = ended(telegram());
    const { bus, texts, deliver } = setup(turn, chat);
    await deliver();

    expect(bus.execute).toHaveBeenCalledTimes(1);
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent).toBeInstanceOf(ReplyOnTelegramCommand);
    expect(sent).toMatchObject({
      organizationId,
      accountId: telegramAccountId,
      chatId: '123456789',
      replyToId: '42',
      text: telegramReplyOf(turn, texts),
      botId,
    });
    expect(sent.text).toBe('Green since 10:12.');
  });

  it('tells the owner a failed turn failed, with why', async () => {
    const { bus, deliver } = setup(ended(telegram(), 'failed'), chat);
    await deliver();
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent.text).toBe('I could not finish that: The key was refused.');
  });

  // Breaks if a console turn's answer leaks to Telegram, a reply goes out
  // before the turn ends, or one goes to a Telegram bot disconnected while
  // the turn ran.
  it('sends nothing for a console turn, a turn still running, a missing turn, or a disconnected chat', async () => {
    const running = telegram();
    running.start(new Date());
    for (const [turn, found] of [
      [ended(consoleTurn()), chat],
      [running, chat],
      [null, chat],
      [ended(telegram()), null],
    ] as const) {
      const { bus, deliver } = setup(turn, found);
      await deliver();
      expect(bus.execute).not.toHaveBeenCalled();
    }
  });
});
