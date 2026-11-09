import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { botDefaultModel } from '@oppenheimer/shared';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import { BOT_CONVERSATION_REPOSITORY, BOT_TURN_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotConversationRepositoryPort } from '../../database/bot-conversation.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { telegramTurn } from '../../domain/bot-telegram-turn.policy';
import { WakeOnTelegramCommand } from './wake-on-telegram.command';

/**
 * The owner's message to their Telegram bot, for the Oppenheimer bot that
 * answers there (`product/next-steps/answering-on-telegram-and-whatsapp.md`):
 * a turn in the chat's conversation that holds the message (by Telegram's
 * own numbering, so deliveries in any order agree), keyed by the message so
 * a delivery twice is one turn; `/new` starts a conversation at itself, so
 * the messages after it are read without what came before; `/stop` asks the conversation's running turn to stop. A bot
 * that is gone, or is not the Telegram bot owner's, is woken by nothing.
 */
@CommandHandler(WakeOnTelegramCommand)
export class WakeOnTelegramCommandHandler implements ICommandHandler<WakeOnTelegramCommand, void> {
  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
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
    if (command.command === 'new') return this.conversations.startTelegram(chat, command.messageId);
    const conversationId = await this.conversations.conversationFor(chat, command.messageId);
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
      {
        conversationId,
        telegramAccountId: command.telegramAccountId,
        chatId: command.chatId,
        messageId: command.messageId,
        text: command.text,
      },
    );
    // Not on the bot's stream, which is its console chat's.
    await this.turns.enqueueOnce(turn, opening, command.metadata.correlationId, null);
  }
}
