import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_MEMORY_DREAM_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotMemoryDreamRepositoryPort } from '../../database/bot-memory-dream.repository.port';
import type { StoredDream } from '../../domain/bot-dream.policy';
import { FindBotMemoryDreamQuery } from './find-bot-memory-dream.query';

/** The bot's latest dream through the caller's scope; null before its first. */
@QueryHandler(FindBotMemoryDreamQuery)
export class FindBotMemoryDreamQueryHandler
  implements IQueryHandler<FindBotMemoryDreamQuery, StoredDream | null>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_MEMORY_DREAM_REPOSITORY) private readonly dreams: BotMemoryDreamRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotMemoryDreamQuery): Promise<StoredDream | null> {
    const bot = await this.lookup.bot(scope, botId);
    const found = await this.dreams.findLatest(bot.organizationId, bot.id);
    return found.isSome() ? found.unwrap() : null;
  }
}
