import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotChannelWakeResolver } from '../../application/bot-channel-wake.resolver';
import { telegramTurn } from '../../domain/bot-telegram-turn.policy';
import { WakeOnTelegramCommand } from './wake-on-telegram.command';

/**
 * The owner's message to their Telegram bot, for the Oppenheimer bot that
 * answers there (`product/next-steps/answering-on-telegram-and-whatsapp.md`):
 * a turn in the chat's conversation that holds the message, the one that
 * starts at the owner's last `/new` before it (fixed when the message was
 * stored, so deliveries in any order agree), keyed by the message so a
 * delivery twice is one turn; `/new` starts a conversation at itself; `/stop`
 * asks the conversation's running turn to stop (`BotChannelWakeResolver`). The
 * resolver wakes only a bot the owner made.
 */
@CommandHandler(WakeOnTelegramCommand)
export class WakeOnTelegramCommandHandler implements ICommandHandler<WakeOnTelegramCommand, void> {
  constructor(private readonly channel: BotChannelWakeResolver) {}

  async execute(command: WakeOnTelegramCommand): Promise<void> {
    const { organizationId, telegramAccountId, chatId, messageId } = command;
    await this.channel.wake({
      chat: { kind: 'telegram', organizationId, botId: command.botId, telegramAccountId, chatId },
      userId: command.userId,
      startsAt: command.conversationStartsAt,
      messageId,
      command: command.command,
      correlationId: command.metadata.correlationId,
      turn: (props, conversationId) =>
        telegramTurn(props, {
          conversationId,
          telegramAccountId,
          chatId,
          messageId,
          text: command.text,
        }),
    });
  }
}
