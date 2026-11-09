import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_REPOSITORY } from '../../bots.di-tokens';
import type { BotRepositoryPort } from '../../database/bot.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { DeleteBotCommand } from './delete-bot.command';

/**
 * Gone for good: the bot, its soul and instructions with their history, and
 * its memory. Not while it answers on a Telegram bot (`BOTS_042`).
 */
@CommandHandler(DeleteBotCommand)
export class DeleteBotCommandHandler implements ICommandHandler<DeleteBotCommand, AggregateID> {
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_REPOSITORY)
    private readonly bots: BotRepositoryPort,
  ) {}

  async execute({ scope, botId }: DeleteBotCommand): Promise<AggregateID> {
    const bot = await this.lookup.bot(scope, botId);
    if ((await this.bots.delete(bot)) === 'answering') {
      throw new AppError(BotErrors.ANSWERS_ON_TELEGRAM, {
        detail:
          'Choose another bot, or none, to answer there in Settings → Telegram, then delete it.',
        extensions: { botId },
      });
    }
    return bot.id;
  }
}
