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
 * its memory. Not while it answers on a Telegram bot (`BOTS_042`) or is a
 * WhatsApp number's default (`BOTS_043`).
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
    const outcome = await this.bots.delete(bot);
    if (outcome !== 'deleted') {
      const { error, setting } = BOUND[outcome.boundTo];
      throw new AppError(error, {
        detail: `Choose another bot, or none, to answer there in ${setting}, then delete it.`,
        extensions: { botId },
      });
    }
    return bot.id;
  }
}

/** What each channel that holds a bot answers a delete with, and where it is changed. */
const BOUND = {
  telegram: { error: BotErrors.ANSWERS_ON_TELEGRAM, setting: 'Settings → Telegram' },
  whatsapp: { error: BotErrors.ANSWERS_ON_WHATSAPP, setting: 'Settings → WhatsApp' },
} as const;
