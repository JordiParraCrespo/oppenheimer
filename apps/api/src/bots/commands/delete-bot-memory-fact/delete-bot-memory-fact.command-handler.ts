import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { DeleteBotMemoryFactCommand } from './delete-bot-memory-fact.command';

/** Forget one fact. */
@CommandHandler(DeleteBotMemoryFactCommand)
export class DeleteBotMemoryFactCommandHandler
  implements ICommandHandler<DeleteBotMemoryFactCommand, AggregateID>
{
  constructor(
    @Inject(BOT_MEMORY_FACT_REPOSITORY)
    private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute({ scope, botId, factId }: DeleteBotMemoryFactCommand): Promise<AggregateID> {
    const fact = requireFound(
      await this.memory.findOneById(scope, botId, factId),
      BotErrors.MEMORY_FACT_NOT_FOUND,
      { detail: `No memory fact with id ${factId}` },
    );
    await this.memory.delete(fact);
    return fact.id;
  }
}
