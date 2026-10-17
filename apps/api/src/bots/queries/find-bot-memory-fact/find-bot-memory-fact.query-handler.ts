import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import type { BotMemoryFactEntity } from '../../domain/bot-memory-fact.entity';
import { BotErrors } from '../../domain/bots.errors';
import { FindBotMemoryFactQuery } from './find-bot-memory-fact.query';

/** No route of its own: adding and editing a fact read their answer back through it. */
@QueryHandler(FindBotMemoryFactQuery)
export class FindBotMemoryFactQueryHandler
  implements IQueryHandler<FindBotMemoryFactQuery, BotMemoryFactEntity>
{
  constructor(
    @Inject(BOT_MEMORY_FACT_REPOSITORY)
    private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute({ scope, botId, factId }: FindBotMemoryFactQuery): Promise<BotMemoryFactEntity> {
    return requireFound(
      await this.memory.findOneById(scope, botId, factId),
      BotErrors.MEMORY_FACT_NOT_FOUND,
      { detail: `No memory fact with id ${factId}` },
    );
  }
}
