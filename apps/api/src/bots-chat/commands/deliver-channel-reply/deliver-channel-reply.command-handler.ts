import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { isChannelOrigin } from '@oppenheimer/shared';
import { ReplyOnTelegramCommand } from '../../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import { ReplyOnWhatsappCommand } from '../../../whatsapp/commands/reply-on-whatsapp/reply-on-whatsapp.command';
import {
  BOT_CONVERSATION_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../../database/bot-conversation.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { channelReplyOf } from '../../domain/bot-channel-turn.policy';
import { telegramMessageIdOf } from '../../domain/bot-telegram-turn.policy';
import { whatsappMessageRowIdOf } from '../../domain/bot-whatsapp-turn.policy';
import { DeliverChannelReplyCommand } from './deliver-channel-reply.command';

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
 * A channel turn's answer goes back to the chat it was asked in
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §4): its last
 * text, or what happened to it, as a reply to the message that opened it.
 * The channel's module sends it (telegram, whatsapp), and only while this
 * bot still answers that chat. The job is not retried, so an answer is not
 * sent twice.
 */
@CommandHandler(DeliverChannelReplyCommand)
export class DeliverChannelReplyCommandHandler
  implements ICommandHandler<DeliverChannelReplyCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  async execute({ turnId, metadata }: DeliverChannelReplyCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const turn = found.unwrap();
    if (!isChannelOrigin(turn.origin) || !turn.ended) return;
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (!chat) return;
    const texts = await this.messages.findTurnTexts(turn.organizationId, turn.id);
    const reply: ChannelReply = {
      organizationId: turn.organizationId,
      chatId: chat.chatId,
      text: channelReplyOf(turn, texts),
      botId: turn.botId,
      metadata: { correlationId: metadata.correlationId },
    };
    const replyOn = REPLY_ON[chat.kind] as (
      chat: BotChannelChat,
      sourceKey: string | null,
      reply: ChannelReply,
    ) => ReplyOnTelegramCommand | ReplyOnWhatsappCommand;
    await this.commands.execute(replyOn(chat, turn.sourceKey, reply));
  }
}
