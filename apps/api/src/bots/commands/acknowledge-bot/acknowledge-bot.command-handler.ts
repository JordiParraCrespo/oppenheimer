import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { AcknowledgeBotCommand } from './acknowledge-bot.command';

/**
 * The person read the bot's chat: everything in it until now is read, so its
 * sidebar row loses the blue dot, and a failed turn its amber one, on every
 * device.
 */
@CommandHandler(AcknowledgeBotCommand)
export class AcknowledgeBotCommandHandler implements ICommandHandler<AcknowledgeBotCommand, void> {
  constructor(@Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort) {}

  async execute({ scope, botId }: AcknowledgeBotCommand): Promise<void> {
    if (!(await this.bots.acknowledge(scope, botId))) {
      throw new AppError(BotErrors.NOT_FOUND);
    }
  }
}
