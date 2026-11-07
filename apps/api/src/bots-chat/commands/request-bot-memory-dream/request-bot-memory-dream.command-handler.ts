import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_MEMORY_DREAM_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMemoryDreamRepositoryPort } from '../../database/bot-memory-dream.repository.port';
import { RequestBotMemoryDreamCommand } from './request-bot-memory-dream.command';

/**
 * Stages a dream of the bot's memory for the `bot-dreams` worker
 * (`25-bots.md` §4.1, "Dreaming"). It runs even with "Learn automatically"
 * off: the owner asked. The dream reads as pending until its job settles,
 * and the chat says when it is done.
 */
@CommandHandler(RequestBotMemoryDreamCommand)
export class RequestBotMemoryDreamCommandHandler
  implements ICommandHandler<RequestBotMemoryDreamCommand, AggregateID>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_MEMORY_DREAM_REPOSITORY) private readonly dreams: BotMemoryDreamRepositoryPort,
  ) {}

  async execute({ scope, botId, metadata }: RequestBotMemoryDreamCommand): Promise<AggregateID> {
    const bot = await this.lookup.bot(scope, botId);
    await this.dreams.requestDream(bot.organizationId, bot.id, metadata.correlationId);
    return bot.id;
  }
}
