import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { botDefaultModel } from '@oppenheimer/shared';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import {
  BOT_CONVERSATION_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotConversationRepositoryPort } from '../../database/bot-conversation.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { telegramTurn } from '../../domain/bot-telegram-turn.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { WakeOnTelegramCommand } from './wake-on-telegram.command';

/**
 * The owner's message to their Telegram bot, for the Oppenheimer bot that
 * answers there (`product/next-steps/answering-on-telegram-and-whatsapp.md`):
 * a turn in the chat's own conversation, keyed by the message so a delivery
 * twice is one turn; `/new` closes the conversation, so the next message
 * opens another; `/stop` asks the conversation's running turn to stop. A bot
 * that is gone, or is not the Telegram bot owner's, is woken by nothing.
 */
@CommandHandler(WakeOnTelegramCommand)
export class WakeOnTelegramCommandHandler implements ICommandHandler<WakeOnTelegramCommand, void> {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly access: BotModelAccessResolver,
  ) {}

  async execute(command: WakeOnTelegramCommand): Promise<void> {
    const bot = await this.access.findBot(command.organizationId, command.botId);
    if (!bot || bot.createdByUserId !== command.userId) return;
    const chat = {
      organizationId: command.organizationId,
      botId: bot.id,
      telegramAccountId: command.telegramAccountId,
      chatId: command.chatId,
    };
    if (command.command === 'new') return this.conversations.closeTelegram(chat);
    const conversationId = await this.conversations.openTelegram(chat);
    if (command.command === 'stop') {
      const running = await this.turns.findRunningIn(command.organizationId, conversationId);
      if (running) await this.turns.requestCancel(running, new Date());
      return;
    }
    const { turn, opening } = telegramTurn(
      {
        organizationId: command.organizationId,
        botId: bot.id,
        requestedByUserId: command.userId,
        provider: bot.provider,
        model: bot.model ?? botDefaultModel(bot.provider).id,
        effort: bot.effort,
      },
      { conversationId, messageId: command.messageId, text: command.text },
    );
    const queued = await this.turns.enqueueOnce(
      turn,
      opening,
      command.metadata.correlationId,
      null,
    );
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
  }
}
