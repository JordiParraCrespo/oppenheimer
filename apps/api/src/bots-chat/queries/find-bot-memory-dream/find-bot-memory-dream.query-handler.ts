import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_MEMORY_DREAM_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMemoryDreamRepositoryPort } from '../../database/bot-memory-dream.repository.port';
import type { DreamState } from '../../domain/bot-dream.policy';
import { FindBotMemoryDreamQuery } from './find-bot-memory-dream.query';

/** The bot's latest dream through the caller's scope (null before its first), and whether one is under way. */
@QueryHandler(FindBotMemoryDreamQuery)
export class FindBotMemoryDreamQueryHandler
  implements IQueryHandler<FindBotMemoryDreamQuery, DreamState>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_MEMORY_DREAM_REPOSITORY) private readonly dreams: BotMemoryDreamRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotMemoryDreamQuery): Promise<DreamState> {
    const bot = await this.lookup.bot(scope, botId);
    return this.dreams.findState(bot.organizationId, bot.id);
  }
}
