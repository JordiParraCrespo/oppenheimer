import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ReplyOnTelegramCommand } from '../../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import {
  BOT_CONVERSATION_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotConversationRepositoryPort } from '../../database/bot-conversation.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { telegramMessageIdOf, telegramReplyOf } from '../../domain/bot-telegram-turn.policy';
import { DeliverTelegramReplyCommand } from './deliver-telegram-reply.command';

/**
 * A Telegram turn's answer goes back to the chat it was asked in
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §4): its last
 * text, or what happened to it, as a reply to the message that opened it.
 * The telegram module sends it, and only while this bot still answers on
 * that Telegram bot. The job is not retried, so an answer is not sent twice.
 */
@CommandHandler(DeliverTelegramReplyCommand)
export class DeliverTelegramReplyCommandHandler
  implements ICommandHandler<DeliverTelegramReplyCommand, void>
{
  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  async execute({ turnId, metadata }: DeliverTelegramReplyCommand): Promise<void> {
    const found = await this.turns.findForRun(turnId);
    if (found.isNone()) return;
    const turn = found.unwrap();
    if (turn.origin !== 'telegram' || !turn.ended) return;
    const chat = await this.conversations.findTelegram(turn.organizationId, turn.conversationId);
    if (!chat) return;
    const texts = await this.messages.findTurnTexts(turn.organizationId, turn.id);
    await this.commands.execute(
      new ReplyOnTelegramCommand({
        organizationId: turn.organizationId,
        accountId: chat.telegramAccountId,
        chatId: chat.chatId,
        replyToId: telegramMessageIdOf(turn.sourceKey),
        text: telegramReplyOf(turn, texts),
        botId: turn.botId,
        metadata: { correlationId: metadata.correlationId },
      }),
    );
  }
}
