import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import type { BotMemoryFactEntity } from '../../domain/bot-memory-fact.entity';
import { FindBotMemoryQuery } from './find-bot-memory.query';

/** Settings → Memory: everything the bot remembers, newest first. */
@QueryHandler(FindBotMemoryQuery)
export class FindBotMemoryQueryHandler
  implements IQueryHandler<FindBotMemoryQuery, BotMemoryFactEntity[]>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_MEMORY_FACT_REPOSITORY)
    private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute({ scope, botId }: FindBotMemoryQuery): Promise<BotMemoryFactEntity[]> {
    await this.lookup.bot(scope, botId);
    return this.memory.findAll(scope, botId);
  }
}
