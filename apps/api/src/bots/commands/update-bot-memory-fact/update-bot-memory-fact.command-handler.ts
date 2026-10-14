import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_FACT_REPOSITORY } from '../../bots.di-tokens';
import type { BotMemoryFactRepositoryPort } from '../../database/bot-memory-fact.repository.port';
import { userActor } from '../../domain/bot.types';
import { BotErrors } from '../../domain/bots.errors';
import { UpdateBotMemoryFactCommand } from './update-bot-memory-fact.command';

/** Reword a fact; the person who did becomes its source. */
@CommandHandler(UpdateBotMemoryFactCommand)
export class UpdateBotMemoryFactCommandHandler
  implements ICommandHandler<UpdateBotMemoryFactCommand, AggregateID>
{
  constructor(
    @Inject(BOT_MEMORY_FACT_REPOSITORY)
    private readonly memory: BotMemoryFactRepositoryPort,
  ) {}

  async execute(command: UpdateBotMemoryFactCommand): Promise<AggregateID> {
    const { scope, botId, factId } = command;
    const fact = requireFound(
      await this.memory.findOneById(scope, botId, factId),
      BotErrors.MEMORY_FACT_NOT_FOUND,
      { detail: `No memory fact with id ${factId}` },
    );
    fact.edit(command.content, userActor(scope.userId));
    if ((await this.memory.save(fact)) === 'missing') {
      throw new AppError(BotErrors.MEMORY_FACT_NOT_FOUND);
    }
    return fact.id;
  }
}
