import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BOT_MESSAGE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { ReactAsBotCommand } from './react-as-bot.command';

/** What a bot's reaction came to: set or taken back on a message, or why not. */
export type ReactAsBotOutcome =
  | { kind: 'reacted'; messageId: string }
  | { kind: 'no_message' }
  | { kind: 'not_yours' };

/**
 * A bot reacts to a message of yours in the conversation its turn runs in:
 * the one it names, or the one that opened the turn. One reaction at a
 * time, beside yours; null takes it back. It wakes nothing.
 */
@CommandHandler(ReactAsBotCommand)
export class ReactAsBotCommandHandler
  implements ICommandHandler<ReactAsBotCommand, ReactAsBotOutcome>
{
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
  ) {}

  async execute(command: ReactAsBotCommand): Promise<ReactAsBotOutcome> {
    const { scope, organizationId, botId, conversationId, turnId, messageId, emoji } = command;
    const message = messageId
      ? await this.messages.findOne(scope, botId, messageId)
      : await this.messages.findOpening(organizationId, turnId);
    if (!message || message.conversationId !== conversationId) return { kind: 'no_message' };
    if (message.role !== 'user') return { kind: 'not_yours' };
    if (message.botReaction !== emoji) {
      message.reactAsBot(emoji);
      await this.messages.saveReaction(message);
    }
    return { kind: 'reacted', messageId: message.id };
  }
}
