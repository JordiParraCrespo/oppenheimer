import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { botDefaultModel } from '@oppenheimer/shared';
import { BotChannelWakeResolver } from '../../application/bot-channel-wake.resolver';
import { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import { telegramTurn } from '../../domain/bot-telegram-turn.policy';
import { WakeOnTelegramCommand } from './wake-on-telegram.command';

/**
 * The owner's message to their Telegram bot, for the Oppenheimer bot that
 * answers there (`product/next-steps/answering-on-telegram-and-whatsapp.md`):
 * a turn in the chat's conversation that holds the message, the one that
 * starts at the owner's last `/new` before it (fixed when the message was
 * stored, so deliveries in any order agree), keyed by the message so a
 * delivery twice is one turn; `/new` starts a conversation at itself; `/stop`
 * asks the conversation's running turn to stop (`BotChannelWakeResolver`). A
 * bot that is gone, or is not the Telegram bot owner's, is woken by nothing.
 */
@CommandHandler(WakeOnTelegramCommand)
export class WakeOnTelegramCommandHandler implements ICommandHandler<WakeOnTelegramCommand, void> {
  constructor(
    private readonly channel: BotChannelWakeResolver,
    private readonly access: BotModelAccessResolver,
  ) {}

  async execute(command: WakeOnTelegramCommand): Promise<void> {
    const bot = await this.access.findBot(command.organizationId, command.botId);
    if (!bot || bot.createdByUserId !== command.userId) return;
    const { organizationId, telegramAccountId, chatId, messageId } = command;
    await this.channel.wake({
      chat: { kind: 'telegram', organizationId, botId: bot.id, telegramAccountId, chatId },
      startsAt: command.conversationStartsAt,
      messageId,
      command: command.command,
      correlationId: command.metadata.correlationId,
      turn: (conversationId) =>
        telegramTurn(
          {
            organizationId,
            botId: bot.id,
            requestedByUserId: command.userId,
            provider: bot.provider,
            model: bot.model ?? botDefaultModel(bot.provider).id,
            effort: bot.effort,
          },
          { conversationId, telegramAccountId, chatId, messageId, text: command.text },
        ),
    });
  }
}
