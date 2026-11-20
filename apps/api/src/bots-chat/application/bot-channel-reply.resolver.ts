import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ReplyOnTelegramCommand } from '../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import { ReplyOnWhatsappCommand } from '../../whatsapp/commands/reply-on-whatsapp/reply-on-whatsapp.command';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../database/bot-conversation.repository.port';
import { telegramMessageIdOf } from '../domain/bot-telegram-turn.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { whatsappMessageRowIdOf } from '../domain/bot-whatsapp-turn.policy';

/** What every channel's reply carries; the channel adds its chat and what it quotes. */
type ChannelReply = Omit<
  ConstructorParameters<typeof ReplyOnTelegramCommand>[0],
  'accountId' | 'replyToId'
>;

/** Each channel's reply, for a chat of its kind and the key of the turn that opened it. */
const REPLY_ON: {
  [K in BotChannelChat['kind']]: (
    chat: Extract<BotChannelChat, { kind: K }>,
    sourceKey: string | null,
    reply: ChannelReply,
  ) => ReplyOnTelegramCommand | ReplyOnWhatsappCommand;
} = {
  telegram: (chat, sourceKey, reply) =>
    new ReplyOnTelegramCommand({
      ...reply,
      accountId: chat.telegramAccountId,
      replyToId: telegramMessageIdOf(sourceKey),
    }),
  whatsapp: (chat, sourceKey, reply) =>
    new ReplyOnWhatsappCommand({
      ...reply,
      accountId: chat.whatsappAccountId,
      replyToRowId: whatsappMessageRowIdOf(sourceKey),
    }),
};

/**
 * Sends a channel turn's words to the chat its conversation is, as a reply to
 * the message that opened the turn, through the module of the chat's channel
 * (telegram, whatsapp), which sends only while this bot still answers that
 * chat. Nothing goes for a conversation that is no channel's chat (any more).
 * What the turn's end owes and what it sends as it goes are the callers'.
 */
@Injectable()
export class BotChannelReplyResolver {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  async send(
    turn: Pick<BotTurnEntity, 'organizationId' | 'conversationId' | 'botId' | 'sourceKey'>,
    text: string,
    correlationId: string | undefined,
  ): Promise<void> {
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (!chat) return;
    const reply: ChannelReply = {
      organizationId: turn.organizationId,
      chatId: chat.chatId,
      text,
      botId: turn.botId,
      metadata: { correlationId },
    };
    const replyOn = REPLY_ON[chat.kind] as (
      chat: BotChannelChat,
      sourceKey: string | null,
      reply: ChannelReply,
    ) => ReplyOnTelegramCommand | ReplyOnWhatsappCommand;
    await this.commands.execute(replyOn(chat, turn.sourceKey, reply));
  }
}
