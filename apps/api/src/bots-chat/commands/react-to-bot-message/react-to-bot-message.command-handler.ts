import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_MESSAGE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotMessageEntity } from '../../domain/bot-message.entity';
import { ReactToBotMessageCommand } from './react-to-bot-message.command';

/**
 * You react to a message of yours or of the bot's: one emoji, replacing the
 * one before, or none. The bot is not woken by it.
 */
@CommandHandler(ReactToBotMessageCommand)
export class ReactToBotMessageCommandHandler
  implements ICommandHandler<ReactToBotMessageCommand, BotMessageEntity>
{
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
  ) {}

  async execute({
    scope,
    botId,
    messageId,
    emoji,
  }: ReactToBotMessageCommand): Promise<BotMessageEntity> {
    const message = await this.messages.findOne(scope, botId, messageId);
    if (!message) throw new AppError(BotErrors.MESSAGE_NOT_FOUND);
    if (!message.reactable) throw new AppError(BotErrors.MESSAGE_NOT_REACTABLE);
    if (message.reaction === emoji) return message;
    message.react(emoji);
    await this.messages.saveReaction(message);
    return message;
  }
}
