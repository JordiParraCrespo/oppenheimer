import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { None, Some } from 'oxide.ts';
import { ReplyOnTelegramCommand } from '../../../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import { ReplyOnWhatsappCommand } from '../../../../whatsapp/commands/reply-on-whatsapp/reply-on-whatsapp.command';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../../../database/bot-conversation.repository.port';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { channelReplyOf } from '../../../domain/bot-channel-turn.policy';
import { telegramTurn } from '../../../domain/bot-telegram-turn.policy';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { whatsappSourceKey } from '../../../domain/bot-whatsapp-turn.policy';
import { DeliverChannelReplyCommand } from '../deliver-channel-reply.command';
import { DeliverChannelReplyCommandHandler } from '../deliver-channel-reply.command-handler';

/**
 * A channel turn's answer going back: once the turn ended, its last words go
 * to the chat its conversation is, as a reply to the message that opened it,
 * through the module of the chat's channel. A console turn, a turn still
 * running, a turn since gone and a chat whose account was disconnected send
 * nothing. Whether the bot still answers there is the channel module's
 * (`ReplyOnTelegramCommandHandler`, `ReplyOnWhatsappCommandHandler`).
 */
const organizationId = randomUUID();
const userId = randomUUID();
const botId = randomUUID();
const telegramAccountId = randomUUID();
const whatsappAccountId = randomUUID();
const messageRowId = randomUUID();
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

/** The turn wave 2's `whatsappTurn` makes: the owner lane, keyed by the stored row. */
function whatsapp(): BotTurnEntity {
  return BotTurnEntity.queue({
    organizationId,
    botId,
    requestedByUserId: userId,
    ...engine,
    conversationId,
    origin: 'whatsapp',
    lane: 'owner',
    sourceKey: whatsappSourceKey({ whatsappAccountId, messageRowId }),
  });
}

function consoleTurn(): BotTurnEntity {
  return BotTurnEntity.queue({ organizationId, botId, requestedByUserId: userId, ...engine });
}

function ended(turn: BotTurnEntity, status: 'completed' | 'failed' = 'completed'): BotTurnEntity {
  turn.start(new Date());
  turn.end(status, new Date(), status === 'failed' ? { error: 'The key was refused.' } : {});
  return turn;
}

function setup(turn: BotTurnEntity | null, chat: BotChannelChat | null = null) {
  const texts = ['Looking it up.', 'Green since 10:12.'];
  const turns = {
    findForRun: vi.fn(async (id: string) => (turn && id === turn.id ? Some(turn) : None)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    findTurnTexts: vi.fn(async () => texts),
  } satisfies Partial<BotMessageRepositoryPort>;
  const conversations = {
    // Any conversation is the chat here, so only the turn's origin keeps a
    // console turn off the channels.
    findChannelChat: vi.fn(async () => chat),
  } satisfies Partial<BotConversationRepositoryPort>;
  const bus = { execute: vi.fn(async () => 1) };
  const handler = new DeliverChannelReplyCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    conversations as unknown as BotConversationRepositoryPort,
    bus as unknown as CommandBus,
  );
  const deliver = () =>
    handler.execute(new DeliverChannelReplyCommand({ turnId: turn?.id ?? randomUUID() }));
  return { bus, texts, deliver };
}

const telegramChat: BotChannelChat = {
  kind: 'telegram',
  organizationId,
  botId,
  telegramAccountId,
  chatId: '123456789',
};
const whatsappChat: BotChannelChat = {
  kind: 'whatsapp',
  organizationId,
  botId,
  whatsappAccountId,
  chatId: '34600111222@s.whatsapp.net',
};

describe('DeliverChannelReplyCommandHandler', () => {
  // Breaks if the reply is not threaded under the message it answers, or goes
  // to another chat or Telegram bot than the conversation's.
  it('replies in the conversation’s Telegram chat, under the message that opened the turn, with its last words', async () => {
    const turn = ended(telegram());
    const { bus, texts, deliver } = setup(turn, telegramChat);
    await deliver();

    expect(bus.execute).toHaveBeenCalledTimes(1);
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent).toBeInstanceOf(ReplyOnTelegramCommand);
    expect(sent).toMatchObject({
      organizationId,
      accountId: telegramAccountId,
      chatId: '123456789',
      replyToId: '42',
      text: channelReplyOf(turn, texts),
      botId,
    });
    expect(sent.text).toBe('Green since 10:12.');
  });

  // Breaks if a WhatsApp answer is sent through Telegram, to another number,
  // or without the stored message it quotes.
  it('replies in the conversation’s WhatsApp chat, quoting the stored message that opened the turn', async () => {
    const { bus, deliver } = setup(ended(whatsapp()), whatsappChat);
    await deliver();

    expect(bus.execute).toHaveBeenCalledTimes(1);
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnWhatsappCommand];
    expect(sent).toBeInstanceOf(ReplyOnWhatsappCommand);
    expect(sent).toMatchObject({
      organizationId,
      accountId: whatsappAccountId,
      chatId: '34600111222@s.whatsapp.net',
      replyToRowId: messageRowId,
      text: 'Green since 10:12.',
      botId,
    });
  });

  it('tells the owner a failed turn failed, with why', async () => {
    const { bus, deliver } = setup(ended(telegram(), 'failed'), telegramChat);
    await deliver();
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent.text).toBe('I could not finish that: The key was refused.');
  });

  // Breaks if a console turn's answer leaks to a channel, a reply goes out
  // before the turn ends, or one goes to an account disconnected while the
  // turn ran.
  it('sends nothing for a console turn, a turn still running, a missing turn, or a disconnected chat', async () => {
    const running = telegram();
    running.start(new Date());
    for (const [turn, found] of [
      [ended(consoleTurn()), telegramChat],
      [ended(consoleTurn()), whatsappChat],
      [running, telegramChat],
      [null, telegramChat],
      [ended(telegram()), null],
      [ended(whatsapp()), null],
    ] as const) {
      const { bus, deliver } = setup(turn, found);
      await deliver();
      expect(bus.execute).not.toHaveBeenCalled();
    }
  });
});
